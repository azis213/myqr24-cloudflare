<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\TagRange;
use InvalidArgumentException;

final class RoutingRangeValidator
{
    public function validate(TagRange $range, ?string $previousEnd): void
    {
        if (! in_array($range->length, [6, 8, 10], true)) {
            throw new InvalidArgumentException('Unsupported range length.');
        }
        $lower = $this->powerOf36($range->length - 2);
        $upper = $this->powerOf36($range->length);
        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/', $range->range_id) !== 1 || ! $this->isDecimal($range->start_value) || ! $this->isDecimal($range->end_value) || $this->compare($range->start_value, $lower) < 0 || $this->compare($range->end_value, $upper) >= 0 || $this->compare($range->start_value, $range->end_value) > 0 || ($previousEnd !== null && $this->compare($range->start_value, $previousEnd) <= 0)) {
            throw new InvalidArgumentException('Invalid or overlapping range index.');
        }
    }

    public function compare(string $left, string $right): int
    {
        $length = strlen($left) <=> strlen($right);
        return $length === 0 ? strcmp($left, $right) : $length;
    }

    private function isDecimal(string $value): bool
    {
        return preg_match('/^(0|[1-9][0-9]*)$/', $value) === 1;
    }

    private function powerOf36(int $exponent): string
    {
        $value = '1';
        for ($index = 0; $index < $exponent; $index++) {
            $carry = 0;
            $result = '';
            foreach (array_reverse(str_split($value)) as $digit) {
                $product = ((int) $digit * 36) + $carry;
                $result = (string) ($product % 10).$result;
                $carry = intdiv($product, 10);
            }
            $value = ($carry === 0 ? '' : (string) $carry).$result;
        }
        return $value;
    }
}
