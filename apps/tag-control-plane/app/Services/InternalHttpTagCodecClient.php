<?php

declare(strict_types=1);

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Http;
use RuntimeException;

final class InternalHttpTagCodecClient implements TagCodecClient
{
    /** @param array{base_url: ?string, api_key: ?string, timeout_seconds?: int} $configuration */
    public function __construct(private readonly array $configuration)
    {
    }

    public function encode(int $length, string $value): array
    {
        $response = $this->post('/api/v1/codec/encode', ['length' => $length, 'value' => $value]);
        $tag = $response['tag'] ?? null;

        if (! is_array($tag) || ! is_string($response['codecVersion'] ?? null)) {
            throw $this->unavailable();
        }

        return [...$tag, 'codecVersion' => $response['codecVersion']];
    }

    public function encodeBatch(int $length, array $values): array
    {
        $response = $this->post('/api/v1/codec/encode-batch', ['length' => $length, 'values' => $values]);
        $tags = $response['tags'] ?? null;
        $codecVersion = $response['codecVersion'] ?? null;

        if (! is_array($tags) || ! is_string($codecVersion) || $codecVersion === '') {
            throw $this->unavailable();
        }

        $normalized = [];
        foreach ($tags as $tag) {
            if (! is_array($tag)) {
                throw $this->unavailable();
            }

            $normalized[] = [...$tag, 'codecVersion' => $codecVersion];
        }

        return $normalized;
    }

    /** @return array<string, mixed> */
    private function post(string $path, array $payload): array
    {
        $baseUrl = $this->configuration['base_url'] ?? null;
        $apiKey = $this->configuration['api_key'] ?? null;
        $timeout = $this->configuration['timeout_seconds'] ?? 3;

        if (! is_string($baseUrl) || $baseUrl === '' || ! is_string($apiKey) || $apiKey === '' || ! is_int($timeout) || $timeout !== 3) {
            throw $this->unavailable();
        }

        try {
            $response = Http::acceptJson()
                ->withToken($apiKey)
                ->timeout($timeout)
                ->post(rtrim($baseUrl, '/').$path, $payload);
        } catch (ConnectionException) {
            throw $this->unavailable();
        }

        if (! $response->successful()) {
            throw $this->unavailable();
        }

        $json = $response->json();

        if (! is_array($json)) {
            throw $this->unavailable();
        }

        return $json;
    }

    private function unavailable(): RuntimeException
    {
        return new RuntimeException('Codec unavailable.');
    }
}