<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AllocationPool;
use App\Models\TagRange;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class AllocationPoolService
{
    /** @param array $input */
    public function create(array $input): AllocationPool
    {
        $this->validateInput($input);

        return DB::transaction(function () use ($input): AllocationPool {
            $ranges = TagRange::query()
                ->whereIn('range_id', $input['rangeIds'])
                ->lockForUpdate()
                ->get();

            if (
                $ranges->count() !== count($input['rangeIds'])
                || $ranges->contains(fn (TagRange $range): bool => !$range->is_active)
                || $ranges->contains(fn (TagRange $range): bool => $range->length !== $input['length'])
            ) {
                throw new RuntimeException('Pool references invalid ranges.');
            }

            $pool = AllocationPool::query()->create([
                'pool_id' => $input['poolId'],
                'organization_id' => $input['organizationId'],
                'display_name' => $input['displayName'],
                'channel' => $input['channel'],
                'length' => $input['length'],
                'policy_ref' => $input['policyRef'],
                'capacity_warning_threshold' => $input['capacityWarningThreshold'],
                'is_active' => $input['active'],
            ]);

            $pool->ranges()->attach($ranges->pluck('id')->all());

            return $pool->load('ranges');
        });
    }

    /** @param array $input */
    private function validateInput(array $input): void
    {
        if (
            !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/', $input['poolId'])
            || !is_string($input['displayName'])
            || trim($input['displayName']) === ''
            || mb_strlen($input['displayName']) > 191
            || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/', $input['channel'])
            || !in_array($input['length'], [6, 8, 10], true)
            || !is_array($input['rangeIds'])
            || $input['rangeIds'] === []
            || count($input['rangeIds']) !== count(array_unique($input['rangeIds']))
            || !is_string($input['policyRef'])
            || trim($input['policyRef']) === ''
            || mb_strlen($input['policyRef']) > 191
            || !is_int($input['capacityWarningThreshold'])
            || $input['capacityWarningThreshold'] < 0
            || !is_bool($input['active'])
            || ($input['organizationId'] !== null && !is_string($input['organizationId']))
        ) {
            throw new RuntimeException('Invalid pool input.');
        }

        foreach ($input['rangeIds'] as $rangeId) {
            if (!is_string($rangeId) || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/', $rangeId)) {
                throw new RuntimeException('Invalid pool range reference.');
            }
        }
    }
}
