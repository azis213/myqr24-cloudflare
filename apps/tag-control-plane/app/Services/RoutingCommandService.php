<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\IdempotencyRecord;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;

final class RoutingCommandService
{
    public function execute(User $user, string $key, string $command, array $input, callable $mutation): array
    {
        if (! Str::isUuid($key)) {
            throw new InvalidArgumentException('Invalid idempotency key.');
        }
        return DB::transaction(function () use ($user, $key, $command, $input, $mutation): array {
            $record = IdempotencyRecord::query()->lockForUpdate()->where('actor_id', $user->id)->where('command', $command)->where('idempotency_key', $key)->first();
            if ($record !== null) {
                if ($record->request_hash !== $this->hash($input)) {
                    throw new RuntimeException('Idempotency request mismatch.');
                }
                return $record->response_payload ?? [];
            }
            $response = $mutation();
            IdempotencyRecord::query()->create(['actor_id' => $user->id, 'command' => $command, 'idempotency_key' => $key, 'request_hash' => $this->hash($input), 'status' => 'completed', 'response_payload' => $response]);
            return $response;
        });
    }

    private function hash(array $input): string
    {
        $canonicalize = function (array $value) use (&$canonicalize): array {
            foreach ($value as $key => $entry) {
                if (is_array($entry)) {
                    $value[$key] = $canonicalize($entry);
                }
            }
            if (! array_is_list($value)) {
                ksort($value);
            }
            return $value;
        };
        return hash('sha256', json_encode($canonicalize($input), JSON_THROW_ON_ERROR));
    }
}
