<?php

declare(strict_types=1);

namespace App\Services;

use InvalidArgumentException;

final class FakeTagCodecClient implements TagCodecClient
{
    private const CODEC_VERSION = 'TEST-S01';

    public function encode(int $length, string $value): array
    {
        if (! in_array($length, [6, 8, 10], true) || ! preg_match('/^(0|[1-9][0-9]*)$/', $value)) {
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
}
