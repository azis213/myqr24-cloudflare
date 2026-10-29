<?php

declare(strict_types=1);

namespace App\Services;

interface TagCodecClient
{
    /** @return array<string, int|string> */
    public function encode(int $length, string $value): array;

    /** @param array<int, string> $values @return array<int, array<string, int|string>> */
    public function encodeBatch(int $length, array $values): array;
}
