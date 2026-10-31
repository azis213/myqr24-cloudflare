<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\FakeTagCodecClient;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

final class FakeTagCodecClientTest extends TestCase
{
    public function test_it_encodes_explicit_canonical_vectors_for_each_supported_length(): void
    {
        $codec = new FakeTagCodecClient();

        foreach ([
            [6, '60466176', '20980d'],
            [8, '78364164096', 'fab5ee18'],
            [10, '101559956668416', '8ebc9372d8'],
        ] as [$length, $value, $id]) {
            self::assertSame([
                'id' => $id,
                'length' => $length,
                'value' => $value,
                'codecVersion' => 'TEST-S01',
            ], $codec->encode($length, $value));
        }
    }

    public function test_batch_encoding_preserves_order_and_matches_single_value_contracts(): void
    {
        $codec = new FakeTagCodecClient();
        $values = ['60466176', '60466177'];

        self::assertSame([
            $codec->encode(6, '60466176'),
            $codec->encode(6, '60466177'),
        ], $codec->encodeBatch(6, $values));
    }

    public function test_it_rejects_noncanonical_values_and_invalid_batches(): void
    {
        $codec = new FakeTagCodecClient();

        foreach ([[6, '1'], [8, '078364164096'], [10, '3656158440062976'], [7, '60466176']] as [$length, $value]) {
            try {
                $codec->encode($length, $value);
                self::fail('Expected invalid codec input to be rejected.');
            } catch (InvalidArgumentException) {
                self::addToAssertionCount(1);
            }
        }

        $this->expectException(InvalidArgumentException::class);
        $codec->encodeBatch(6, ['60466176', '60466176']);
    }
}