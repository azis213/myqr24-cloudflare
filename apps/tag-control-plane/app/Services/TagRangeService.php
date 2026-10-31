<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\TagRange;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class TagRangeService
{
    /** @param array $input */
    public function create(array $input): TagRange
    {
        $this->validateInput($input);

        return DB::transaction(function () use ($input): TagRange {
            $this->assertNoOverlap(
                $input['length'],
                $input['startValue'],
                $input['endValue'],
            );

            return TagRange::query()->create([
                'range_id' => $input['rangeId'],
                'group_id' => $input['groupId'],
                'length' => $input['length'],
                'start_value' => $input['startValue'],
                'end_value' => $input['endValue'],
                'is_active' => $input['active'],
            ]);
        });
    }

    /** @param array $input */
    public function update(TagRange $range, array $input): TagRange
    {
        if ($range->range_id !== $input['rangeId'] || $range->length !== $input['length']) {
            throw new RuntimeException('Range identity is immutable.');
        }

        $this->validateInput($input);

        return DB::transaction(function () use ($range, $input): TagRange {
            $lockedRange = TagRange::query()->lockForUpdate()->findOrFail($range->id);
            $this->assertNoOverlap($input['length'], $input['startValue'], $input['endValue'], $lockedRange->id);

            if ($lockedRange->is_active && ! $input['active'] && $lockedRange->pools()->where('is_active', true)->exists()) {
                throw new RuntimeException('Active pools reference this range.');
            }

            $lockedRange->update([
                'group_id' => $input['groupId'],
                'start_value' => $input['startValue'],
                'end_value' => $input['endValue'],
                'is_active' => $input['active'],
            ]);

            return $lockedRange->refresh();
        });
    }

    /** @param array $input */
    private function validateInput(array $input): void
    {
        if (
            !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/', $input['rangeId'])
            || !preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/', $input['groupId'])
            || !in_array($input['length'], [6, 8, 10], true)
            || !$this->isCanonicalDecimal($input['startValue'])
            || !$this->isCanonicalDecimal($input['endValue'])
            || $this->compareDecimal($input['startValue'], $input['endValue']) > 0
        ) {
            throw new RuntimeException('Invalid range input.');
        }

        $lowerBound = $this->powerOf36($input['length'] - 1);
        $upperBound = $this->powerOf36($input['length']);

        if (
            $this->compareDecimal($input['startValue'], $lowerBound) < 0
            || $this->compareDecimal($input['endValue'], $upperBound) >= 0
        ) {
            throw new RuntimeException('Range is outside canonical domain.');
        }
    }

    private function assertNoOverlap(int $length, string $startValue, string $endValue, ?string $excludedId = null): void
    {
        $ranges = TagRange::query()
            ->where('length', $length)
            ->when($excludedId !== null, fn ($query) => $query->where('id', '!=', $excludedId))
            ->lockForUpdate()
            ->get(['start_value', 'end_value']);

        foreach ($ranges as $range) {
            if (
                $this->compareDecimal($startValue, $range->end_value) <= 0
                && $this->compareDecimal($endValue, $range->start_value) >= 0
            ) {
                throw new RuntimeException('Range overlaps an existing range.');
            }
        }
    }

    private function isCanonicalDecimal(string $value): bool
    {
        return preg_match('/^(0|[1-9][0-9]*)$/', $value) === 1;
    }

    private function powerOf36(int $exponent): string
    {
        $value = '1';

        for ($index = 0; $index < $exponent; $index++) {
            $value = $this->multiplyBySmallInteger($value, 36);
        }

        return $value;
    }

    private function multiplyBySmallInteger(string $value, int $factor): string
    {
        $carry = 0;
        $result = '';

        foreach (array_reverse(str_split($value)) as $digit) {
            $product = ((int) $digit * $factor) + $carry;
            $result = (string) ($product % 10).$result;
            $carry = intdiv($product, 10);
        }

        return ($carry === 0 ? '' : (string) $carry).$result;
    }

    private function compareDecimal(string $left, string $right): int
    {
        $lengthComparison = strlen($left) <=> strlen($right);

        return $lengthComparison === 0 ? strcmp($left, $right) : $lengthComparison;
    }
}
