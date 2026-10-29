<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\EmailMfaChallenge;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use RuntimeException;

final class AuthenticationService
{
    private const PENDING_USER_SESSION_KEY = 'tcp.pending_mfa_user_id';
    private const PENDING_CHALLENGE_SESSION_KEY = 'tcp.pending_mfa_challenge_id';
    private const TAG_MANAGEMENT_REAUTH_SESSION_KEY = 'tcp.tag_management.reauthenticated_at';

    public function __construct(
        private readonly AuditService $auditService,
    ) {
    }

    public function beginLogin(Request $request, string $email, string $password): array
    {
        $user = User::query()
            ->where('email', mb_strtolower($email))
            ->where('is_active', true)
            ->first();

        if ($user === null || ! Hash::check($password, $user->password)) {
            $this->auditService->record(
                correlationId: $this->correlationId($request),
                actorType: 'anonymous',
                actorId: 'unknown',
                objectType: 'authentication',
                objectId: hash('sha256', mb_strtolower($email)),
                action: 'authentication.login.rejected',
            );

            throw new RuntimeException('Invalid credentials.');
        }

        if (! config('security.email_mfa.enabled')) {
            $this->completeLogin($request, $user, 'authentication.login.password_only');

            return ['status' => 'authenticated'];
        }

        ['challenge' => $challenge, 'plainCode' => $plainCode] = $this->createChallenge($user);

        $request->session()->put(self::PENDING_USER_SESSION_KEY, $user->id);
        $request->session()->put(self::PENDING_CHALLENGE_SESSION_KEY, $challenge->id);

        $this->auditService->record(
            correlationId: $this->correlationId($request),
            actorType: 'user',
            actorId: $user->id,
            objectType: 'email_mfa_challenge',
            objectId: $challenge->id,
            action: 'authentication.mfa.challenge_issued',
        );

        Mail::raw(
            "Ihr myQR24 TAG Control Center Sicherheitscode lautet: {$plainCode}\n\n"
            ."Er ist nur für kurze Zeit gültig. Geben Sie ihn niemals weiter.",
            static function ($message) use ($user): void {
                $message->to($user->email)->subject('myQR24 TAG Control Center Sicherheitscode');
            },
        );

        return ['status' => 'mfa_required'];
    }

    public function verifyEmailMfa(Request $request, string $code): void
    {
        $challengeId = $request->session()->get(self::PENDING_CHALLENGE_SESSION_KEY);
        $userId = $request->session()->get(self::PENDING_USER_SESSION_KEY);

        if (! is_string($challengeId) || ! is_string($userId)) {
            throw new RuntimeException('No pending MFA challenge.');
        }

        $challenge = EmailMfaChallenge::query()
            ->whereKey($challengeId)
            ->where('user_id', $userId)
            ->first();

        if ($challenge === null || $challenge->consumed_at !== null || $challenge->expires_at->isPast()) {
            $this->clearPendingChallenge($request);
            throw new RuntimeException('MFA challenge expired.');
        }

        if ($challenge->attempt_count >= config('security.email_mfa.max_attempts')) {
            $this->clearPendingChallenge($request);
            throw new RuntimeException('MFA attempt limit reached.');
        }

        if (! Hash::check($code, $challenge->code_hash)) {
            $challenge->increment('attempt_count');

            $this->auditService->record(
                correlationId: $this->correlationId($request),
                actorType: 'user',
                actorId: $userId,
                objectType: 'email_mfa_challenge',
                objectId: $challenge->id,
                action: 'authentication.mfa.verification_rejected',
            );

            throw new RuntimeException('Invalid MFA code.');
        }

        $user = User::query()->whereKey($userId)->where('is_active', true)->first();

        if ($user === null) {
            $this->clearPendingChallenge($request);
            throw new RuntimeException('User is no longer active.');
        }

        DB::transaction(function () use ($challenge, $request, $user): void {
            $challenge->update(['consumed_at' => CarbonImmutable::now('UTC')]);
            $this->completeLogin($request, $user, 'authentication.mfa.verified');
        });

        $this->clearPendingChallenge($request);
    }

    public function reauthenticateForTagManagement(Request $request, string $password): void
    {
        $user = Auth::guard('web')->user();

        if (! $user instanceof User || ! Hash::check($password, $user->password)) {
            if ($user instanceof User) {
                $this->auditService->record(
                    correlationId: $this->correlationId($request),
                    actorType: 'user',
                    actorId: $user->id,
                    objectType: 'tag_management',
                    objectId: $user->id,
                    action: 'tag_management.reauthentication.rejected',
                );
            }

            throw new RuntimeException('Invalid re-authentication.');
        }

        $request->session()->put(self::TAG_MANAGEMENT_REAUTH_SESSION_KEY, CarbonImmutable::now('UTC')->getTimestamp());

        $this->auditService->record(
            correlationId: $this->correlationId($request),
            actorType: 'user',
            actorId: $user->id,
            objectType: 'tag_management',
            objectId: $user->id,
            action: 'tag_management.reauthentication.completed',
        );
    }

    public function hasRecentTagManagementReauthentication(Request $request): bool
    {
        $reauthenticatedAt = $request->session()->get(self::TAG_MANAGEMENT_REAUTH_SESSION_KEY);

        return is_int($reauthenticatedAt)
            && $reauthenticatedAt >= CarbonImmutable::now('UTC')
                ->subSeconds(config('security.tag_management.reauth_ttl_seconds'))
                ->getTimestamp();
    }

    public function logout(Request $request): void
    {
        $actorId = Auth::guard('web')->id();
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        if (is_string($actorId)) {
            $this->auditService->record(
                correlationId: $this->correlationId($request),
                actorType: 'user',
                actorId: $actorId,
                objectType: 'authentication',
                objectId: $actorId,
                action: 'authentication.logout',
            );
        }
    }

    private function createChallenge(User $user): array
    {
        $plainCode = (string) random_int(100000, 999999);

        EmailMfaChallenge::query()
            ->where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => CarbonImmutable::now('UTC')]);

        $challenge = EmailMfaChallenge::query()->create([
            'user_id' => $user->id,
            'code_hash' => Hash::make($plainCode),
            'expires_at' => CarbonImmutable::now('UTC')->addSeconds(
                config('security.email_mfa.code_ttl_seconds'),
            ),
        ]);

        return [
            'challenge' => $challenge,
            'plainCode' => $plainCode,
        ];
    }

    private function completeLogin(Request $request, User $user, string $action): void
    {
        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        $this->auditService->record(
            correlationId: $this->correlationId($request),
            actorType: 'user',
            actorId: $user->id,
            objectType: 'authentication',
            objectId: $user->id,
            action: $action,
            metadata: ['role' => $user->role],
        );
    }

    private function clearPendingChallenge(Request $request): void
    {
        $request->session()->forget([
            self::PENDING_USER_SESSION_KEY,
            self::PENDING_CHALLENGE_SESSION_KEY,
        ]);
    }

    private function correlationId(Request $request): string
    {
        $correlationId = $request->attributes->get('correlation_id');

        if (! is_string($correlationId) || ! Str::isUuid($correlationId)) {
            throw new RuntimeException('Missing request correlation ID.');
        }

        return $correlationId;
    }
}
