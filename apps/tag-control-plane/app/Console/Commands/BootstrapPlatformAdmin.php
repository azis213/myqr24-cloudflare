<?php

declare(strict_types=1);

namespace App\Console\Commands;

use App\Models\User;
use App\Services\AuditService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class BootstrapPlatformAdmin extends Command
{
    protected $signature = 'tcp:bootstrap-platform-admin
                            {--reset-password : Set the configured initial password on the existing bootstrap account}';

    protected $description = 'Create the configured initial platform administrator or explicitly reset its password.';

    public function handle(AuditService $auditService): int
    {
        $email = mb_strtolower((string) config('security.bootstrap_admin.email'));
        $password = config('security.bootstrap_admin.initial_password');

        if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
            throw new InvalidArgumentException('TCP_BOOTSTRAP_ADMIN_EMAIL must be a valid email address.');
        }

        if (! is_string($password) || $password === '') {
            throw new InvalidArgumentException(
                'TCP_BOOTSTRAP_ADMIN_INITIAL_PASSWORD must be set before running the bootstrap command.',
            );
        }

        $resetPassword = (bool) $this->option('reset-password');
        $correlationId = (string) Str::uuid();

        DB::transaction(function () use ($auditService, $correlationId, $email, $password, $resetPassword): void {
            $user = User::query()->where('email', $email)->lockForUpdate()->first();

            if ($user === null) {
                $user = User::query()->create([
                    'email' => $email,
                    'password' => Hash::make($password),
                    'role' => 'platform-admin',
                    'is_active' => true,
                ]);

                $auditService->record(
                    correlationId: $correlationId,
                    actorType: 'system-process',
                    actorId: 'tcp-bootstrap-command',
                    objectType: 'user',
                    objectId: $user->id,
                    action: 'authentication.bootstrap_admin.created',
                    metadata: ['role' => 'platform-admin'],
                );

                $this->info('The configured platform administrator was created.');

                return;
            }

            if (! $resetPassword) {
                $this->info('The configured platform administrator already exists; no changes were made.');

                return;
            }

            $user->update([
                'password' => Hash::make($password),
                'is_active' => true,
            ]);

            $auditService->record(
                correlationId: $correlationId,
                actorType: 'system-process',
                actorId: 'tcp-bootstrap-command',
                objectType: 'user',
                objectId: $user->id,
                action: 'authentication.bootstrap_admin.password_reset',
                metadata: ['role' => $user->role],
            );

            $this->warn('The configured platform administrator password was reset.');
        });

        return self::SUCCESS;
    }
}
