<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AllocationJob;
use App\Models\AllocationPool;
use App\Models\IdempotencyRecord;
use App\Models\TagAllocation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

final class TagAllocationService
{
    public function __construct(
        private readonly TagCodecClient $codec,
        private readonly AuditService $auditService,
    ) {
    }

    /** @return array */
    public function reserve(
        Request $request,
        User $actor,
        AllocationPool $pool,
        int $quantity,
        string $idempotencyKey,
    ): array {
        $requestHash = hash('sha256', json_encode([
            'pool_id' => $pool->pool_id,
            'quantity' => $quantity,
        ], JSON_THROW_ON_ERROR));

        $record = DB::transaction(function () use (
            $actor,
            $idempotencyKey,
            $pool,
            $quantity,
            $requestHash,
        ): IdempotencyRecord {
            $existing = IdempotencyRecord::query()
                ->lockForUpdate()
                ->where('actor_id', $actor->id)
                ->where('command', 'allocation.reserve')
                ->where('idempotency_key', $idempotencyKey)
                ->first();

            if ($existing !== null) {
                if ($existing->request_hash !== $requestHash) {
                    throw new RuntimeException('Idempotency request mismatch.');
                }

                return $existing;
            }

            $lockedPool = AllocationPool::query()
                ->with('ranges')
                ->lockForUpdate()
                ->findOrFail($pool->id);

            if (! $lockedPool->is_active || $lockedPool->ranges->isEmpty()) {
                throw new RuntimeException('Pool is not allocatable.');
            }

            $values = $this->selectValues($lockedPool, $quantity);

            $job = AllocationJob::query()->create([
                'pool_id' => $lockedPool->id,
                'actor_id' => $actor->id,
                'organization_id' => $lockedPool->organization_id,
                'quantity' => $quantity,
                'status' => 'reserved',
                'reserved_values' => $values,
            ]);
            $range = $lockedPool->ranges->firstOrFail();

            foreach ($values as $value) {
                TagAllocation::query()->create([
                    'pool_id' => $lockedPool->id,
                    'range_id' => $range->id,
                    'organization_id' => $lockedPool->organization_id,
                    'length' => $lockedPool->length,
                    'decoded_value' => $value,
                    'status' => 'codec-pending',
                    'allocation_job_id' => $job->id,
                ]);
            }

            return IdempotencyRecord::query()->create([
                'actor_id' => $actor->id,
                'command' => 'allocation.reserve',
                'idempotency_key' => $idempotencyKey,
                'request_hash' => $requestHash,
                'status' => 'pending',
                'allocation_job_id' => $job->id,
            ]);
        });

        if ($record->status === 'completed') {
            return $record->response_payload ?? [];
        }

        $job = AllocationJob::query()->with('pool.ranges')->findOrFail($record->allocation_job_id);
        $values = $job->reserved_values;

        try {
            $encoded = $this->codec->encodeBatch($job->pool->length, $values);
        } catch (\Throwable $exception) {
            $job->update(['status' => 'codec_failed']);

            throw new RuntimeException('Codec unavailable.', previous: $exception);
        }

        return DB::transaction(function () use ($actor, $encoded, $job, $record, $request): array {
            $lockedRecord = IdempotencyRecord::query()->lockForUpdate()->findOrFail($record->id);

            if ($lockedRecord->status === 'completed') {
                return $lockedRecord->response_payload ?? [];
            }

            $this->validateCodecResponse($job->pool->length, $job->reserved_values, $encoded);
            $tags = [];
            foreach ($encoded as $entry) {
                TagAllocation::query()
                    ->where('allocation_job_id', $job->id)
                    ->where('length', $entry['length'])
                    ->where('decoded_value', $entry['value'])
                    ->where('status', 'codec-pending')
                    ->update([
                        'tag_id' => $entry['id'],
                        'codec_version' => $entry['codecVersion'],
                        'status' => 'draft',
                    ]);

                $tags[] = $entry;
            }

            $response = [
                'job_id' => $job->id,
                'tags' => $tags,
            ];

            $job->update(['status' => 'completed']);
            $lockedRecord->update([
                'status' => 'completed',
                'response_payload' => $response,
            ]);

            $this->auditService->record(
                correlationId: $this->correlationId($request),
                actorType: 'user',
                actorId: $actor->id,
                objectType: 'allocation_job',
                objectId: $job->id,
                action: 'tag_management.allocation.completed',
                metadata: ['quantity' => $job->quantity],
            );

            return $response;
        });
    }

    /** @return array */
    private function selectValues(AllocationPool $pool, int $quantity): array
    {
        $range = $pool->ranges->first();

        if ($range === null || ! $range->is_active || $range->length !== $pool->length) {
            throw new RuntimeException('Pool range is not allocatable.');
        }

        $allocated = TagAllocation::query()
            ->where('range_id', $range->id)
            ->pluck('decoded_value')
            ->all();
        $taken = array_fill_keys($allocated, true);
        $values = [];
        $candidate = $range->start_value;

        while ($this->compareDecimal($candidate, $range->end_value) <= 0) {
            if (! isset($taken[$candidate])) {
                $values[] = $candidate;
            }

            if (count($values) === $quantity) {
                return $values;
            }

            $candidate = $this->incrementDecimal($candidate);
        }

        throw new RuntimeException('Pool capacity exhausted.');
    }

    private function compareDecimal(string $left, string $right): int
    {
        $lengthComparison = strlen($left) <=> strlen($right);

        return $lengthComparison === 0 ? strcmp($left, $right) : $lengthComparison;
    }

    private function incrementDecimal(string $value): string
    {
        $digits = str_split($value);
        $carry = 1;

        for ($index = count($digits) - 1; $index >= 0 && $carry === 1; $index--) {
            if ($digits[$index] === '9') {
                $digits[$index] = '0';

                continue;
            }

            $digits[$index] = (string) ((int) $digits[$index] + 1);
            $carry = 0;
        }

        return ($carry === 1 ? '1' : '').implode('', $digits);
    }

    /** @param array $values @param array $encoded */
    private function validateCodecResponse(int $length, array $values, array $encoded): void
    {
        if (count($values) !== count($encoded)) {
            throw new RuntimeException('Invalid codec response.');
        }

        foreach ($encoded as $index => $entry) {
            if (
                ($entry['length'] ?? null) !== $length
                || ($entry['value'] ?? null) !== $values[$index]
                || ! is_string($entry['id'] ?? null)
                || ! preg_match('/^[0-9a-z]{'.$length.'}$/', $entry['id'])
                || ! is_string($entry['codecVersion'] ?? null)
                || $entry['codecVersion'] === ''
            ) {
                throw new RuntimeException('Invalid codec response.');
            }
        }
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
