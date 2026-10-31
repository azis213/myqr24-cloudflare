<?php

declare(strict_types=1);

namespace App\Services;

use InvalidArgumentException;

final class FakeTagCodecClient implements TagCodecClient
{
    private const CODEC_VERSION = 'TEST-S01';

    public function encode(int $length, string $value): array
    {
        if (! in_array($length, [6, 8, 10], true) || ! $this->isCanonicalValue($length, $value)) {
            throw new InvalidArgumentException('Unsupported synthetic codec input.');
        }

        return [
            'id' => substr(hash('sha256', "{$length}:{$value}"), 0, $length),
            'length' => $length,
            'value' => $value,
            'codecVersion' => self::CODEC_VERSION,
        ];
    }

    public function encodeBatch(int $length, array $values): array
    {
        if ($values === [] || count($values) > 1000 || count($values) !== count(array_unique($values))) {
            throw new InvalidArgumentException('Invalid synthetic codec batch.');
        }

        return array_map(
            fn (string $value): array => $this->encode($length, $value),
            $values,
        );
    }

    private function isCanonicalValue(int $length, string $value): bool
    {
        if (preg_match('/^[1-9][0-9]*$/', $value) !== 1) {
            return false;
        }

        $lowerBound = $this->powerOf36($length - 1);
        $upperBound = $this->powerOf36($length);

        return $this->compareDecimal($value, $lowerBound) >= 0
            && $this->compareDecimal($value, $upperBound) < 0;
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

    private function compareDecimal(string $left, string $right): int
    {
        $lengthComparison = strlen($left) <=> strlen($right);

        return $lengthComparison === 0 ? strcmp($left, $right) : $lengthComparison;
    }
}
