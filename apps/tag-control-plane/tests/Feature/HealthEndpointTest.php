<?php

declare(strict_types=1);

namespace Tests\Feature;

use Illuminate\Support\Str;
use Tests\TestCase;

final class HealthEndpointTest extends TestCase
{
    public function test_health_endpoint_preserves_a_valid_client_correlation_id(): void
    {
        $correlationId = '2f5fa902-d680-4a3e-ac59-a1c34ba70656';

        $response = $this
            ->withHeader('X-Correlation-Id', $correlationId)
            ->getJson('/api/v1/health');

        $response
            ->assertOk()
            ->assertHeader('X-Correlation-Id', $correlationId)
            ->assertJsonPath('status', 'ok')
            ->assertJsonPath('service', 'tag-control-plane')
            ->assertJsonPath('correlation_id', $correlationId);
    }

    public function test_health_endpoint_replaces_an_invalid_client_correlation_id(): void
    {
        $response = $this
            ->withHeader('X-Correlation-Id', 'not-a-uuid')
            ->getJson('/api/v1/health');

        $correlationId = (string) $response->json('correlation_id');

        $response
            ->assertOk()
            ->assertHeader('X-Correlation-Id', $correlationId);

        self::assertTrue(Str::isUuid($correlationId));
    }
}
