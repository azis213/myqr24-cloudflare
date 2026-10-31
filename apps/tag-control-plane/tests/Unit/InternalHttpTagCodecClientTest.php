<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Services\InternalHttpTagCodecClient;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

final class InternalHttpTagCodecClientTest extends TestCase
{
    protected function tearDown(): void
    {
        Http::allowStrayRequests();
        parent::tearDown();
    }

    public function test_it_sends_one_authenticated_batch_request_and_normalizes_the_response(): void
    {
        Http::preventStrayRequests();
        Http::fake([
            'https://codec.example.invalid/api/v1/codec/encode-batch' => Http::response([
                'codecVersion' => 'S01',
                'tags' => [['id' => '20980d', 'length' => 6, 'value' => '60466176']],
            ]),
        ]);

        $result = $this->client()->encodeBatch(6, ['60466176']);

        self::assertSame([['id' => '20980d', 'length' => 6, 'value' => '60466176', 'codecVersion' => 'S01']], $result);
        Http::assertSent(function (Request $request): bool {
            return $request->url() === 'https://codec.example.invalid/api/v1/codec/encode-batch'
                && $request->method() === 'POST'
                && $request->hasHeader('Authorization', 'Bearer synthetic-server-only-key')
                && $request->data() === ['length' => 6, 'values' => ['60466176']];
        });
        Http::assertSentCount(1);
    }

    public function test_it_normalizes_transport_http_and_schema_failures_without_exposing_details(): void
    {
        foreach ([
            fn () => Http::fake(fn () => throw new ConnectionException('socket detail')),
            fn () => Http::fake(['*' => Http::response(['error' => ['code' => 'invalid_request']], 429)]),
            fn () => Http::fake(['*' => Http::response(['error' => ['code' => 'codec_unavailable']], 500)]),
            fn () => Http::fake(['*' => Http::response(['codecVersion' => 'S01', 'tags' => 'invalid'])]),
        ] as $configureFailure) {
            Http::preventStrayRequests();
            $configureFailure();

            try {
                $this->client()->encodeBatch(6, ['60466176']);
                self::fail('Expected codec failure.');
            } catch (RuntimeException $exception) {
                self::assertSame('Codec unavailable.', $exception->getMessage());
            }
        }
    }

    public function test_it_fails_closed_without_server_side_configuration(): void
    {
        $client = new InternalHttpTagCodecClient(['base_url' => null, 'api_key' => null, 'timeout_seconds' => 3]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Codec unavailable.');
        $client->encode(6, '60466176');
    }

    private function client(): InternalHttpTagCodecClient
    {
        return new InternalHttpTagCodecClient([
            'base_url' => 'https://codec.example.invalid',
            'api_key' => 'synthetic-server-only-key',
            'timeout_seconds' => 3,
        ]);
    }
}