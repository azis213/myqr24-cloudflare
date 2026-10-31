<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AllocationPool;
use App\Models\TagRange;
use App\Models\User;
use App\Services\InternalHttpTagCodecClient;
use App\Services\TagCodecClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class LocalHttpCodecIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('security.email_mfa.enabled', false);
        config()->set('security.tag_management.reauth_ttl_seconds', 900);
        config()->set('security.tag_codec.driver', 'http');
        config()->set('security.tag_codec.base_url', env('TCP_TAG_CODEC_BASE_URL'));
        config()->set('security.tag_codec.api_key', env('TCP_TAG_CODEC_API_KEY'));
        config()->set('security.tag_codec.timeout_seconds', 3);
        $this->app->forgetInstance(TagCodecClient::class);
    }

    public function test_local_http_codec_reserves_canonical_tags_for_all_supported_lengths(): void
    {
        self::assertInstanceOf(InternalHttpTagCodecClient::class, $this->app->make(TagCodecClient::class));

        foreach ([
            6 => '60466176',
            8 => '78364164096',
            10 => '101559956668416',
        ] as $length => $startValue) {
            $user = $this->user("local-http-{$length}@example.test");
            $pool = $this->pool($length, $startValue);
            $this->actingAs($user);
            $this->reauthenticate();
            $headers = ['Idempotency-Key' => sprintf('00000000-0000-4000-8000-%012d', $length)];

            $first = $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", ['quantity' => 1], $headers)
                ->assertCreated()
                ->assertJsonPath('tags.0.length', $length)
                ->assertJsonPath('tags.0.value', $startValue)
                ->assertJsonPath('tags.0.codecVersion', 'S01');

            $tagId = $first->json('tags.0.id');
            self::assertMatchesRegularExpression('/^[0-9a-z]{'.$length.'}$/', $tagId);
            $this->assertDatabaseHas('tag_allocations', [
                'decoded_value' => $startValue,
                'tag_id' => $tagId,
                'codec_version' => 'S01',
                'status' => 'draft',
            ]);

            $second = $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", ['quantity' => 1], $headers)
                ->assertCreated();
            self::assertSame($first->json('job_id'), $second->json('job_id'));
        }
    }

    private function user(string $email): User
    {
        return User::query()->create([
            'email' => $email,
            'password' => Hash::make('correct-password'),
            'role' => 'platform-admin',
            'is_active' => true,
        ]);
    }

    private function pool(int $length, string $startValue): AllocationPool
    {
        $range = TagRange::query()->create([
            'range_id' => "local-http-range-{$length}",
            'group_id' => 'local-http-group',
            'length' => $length,
            'start_value' => $startValue,
            'end_value' => $this->incrementDecimal($startValue),
            'is_active' => true,
        ]);
        $pool = AllocationPool::query()->create([
            'pool_id' => "local-http-pool-{$length}",
            'display_name' => 'Local HTTP Codec Pool',
            'channel' => 'local-test',
            'length' => $length,
            'policy_ref' => 'local-test-policy',
            'capacity_warning_threshold' => 1,
            'is_active' => true,
        ]);
        $pool->ranges()->attach($range->id);

        return $pool;
    }

    private function reauthenticate(): void
    {
        $this->postJson('/api/v1/auth/tag-management/reauthenticate', [
            'password' => 'correct-password',
        ])->assertOk();
    }

    private function incrementDecimal(string $value): string
    {
        $digits = str_split($value);
        $carry = 1;

        for ($index = count($digits) - 1; $index >= 0 && $carry === 1; $index--) {
            if ($digits[$index] === '9') {
                $digits[$index] = '0';

                continue;
            }

            $digits[$index] = (string) ((int) $digits[$index] + 1);
            $carry = 0;
        }

        return ($carry === 1 ? '1' : '').implode('', $digits);
    }
}