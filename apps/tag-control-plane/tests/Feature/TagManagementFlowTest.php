<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AllocationPool;
use App\Models\Organization;
use App\Models\TagRange;
use App\Models\User;
use App\Services\FakeTagCodecClient;
use App\Services\TagCodecClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class TagManagementFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('security.email_mfa.enabled', false);
        config()->set('security.tag_management.reauth_ttl_seconds', 900);
    }

    public function test_reservation_requires_recent_reauthentication_and_persists_a_secret_free_mapping(): void
    {
        $user = $this->createUser('platform-admin');
        $pool = $this->createPool();

        $this->actingAs($user);

        $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", [
            'quantity' => 2,
        ], [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000001',
        ])->assertForbidden();

        $this->postJson('/api/v1/auth/tag-management/reauthenticate', [
            'password' => 'correct-password',
        ])->assertOk()
            ->assertJsonPath('status', 'reauthenticated');

        $response = $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", [
            'quantity' => 2,
        ], [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000001',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('tags.0.length', 6)
            ->assertJsonPath('tags.0.codecVersion', 'TEST-S01')
            ->assertJsonCount(2, 'tags');

        $this->assertDatabaseCount('tag_allocations', 2);
        $this->assertDatabaseHas('tag_allocations', [
            'decoded_value' => '60466176',
            'codec_version' => 'TEST-S01',
            'status' => 'draft',
        ]);
        $this->assertDatabaseMissing('tag_allocations', [
            'codec_version' => 'FEISTEL_SECRET_S01',
        ]);
    }

    public function test_same_idempotency_key_returns_the_existing_allocation_without_creating_a_second_mapping(): void
    {
        $user = $this->createUser('platform-admin');
        $pool = $this->createPool();
        $this->actingAs($user);
        $this->reauthenticate();

        $headers = ['Idempotency-Key' => '00000000-0000-4000-8000-000000000002'];

        $first = $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", [
            'quantity' => 1,
        ], $headers)->assertCreated();

        $second = $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", [
            'quantity' => 1,
        ], $headers)->assertCreated();

        self::assertSame(
            $first->json('job_id'),
            $second->json('job_id'),
        );
        $this->assertDatabaseCount('tag_allocations', 1);
        $this->assertDatabaseCount('idempotency_records', 1);

        $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", [
            'quantity' => 2,
        ], $headers)->assertConflict();
    }

    public function test_organization_operator_can_only_read_and_reserve_an_assigned_pool(): void
    {
        $organization = Organization::query()->create([
            'display_name' => 'Synthetic Organization',
            'is_active' => true,
        ]);
        $operator = $this->createUser('organization-operator');
        $otherPool = $this->createPool();
        $assignedPool = $this->createPool($organization->id, 'assigned-pool');

        $organization->users()->attach($operator->id, ['role' => 'allocation-operator']);
        $this->actingAs($operator);

        $this->getJson('/api/v1/admin/tag-management/pools')
            ->assertOk()
            ->assertJsonCount(1, 'pools')
            ->assertJsonPath('pools.0.poolId', 'assigned-pool');

        $this->reauthenticate();

        $this->postJson("/api/v1/admin/tag-management/pools/{$otherPool->pool_id}/reservations", [
            'quantity' => 1,
        ], [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000003',
        ])->assertForbidden();

        $this->postJson('/api/v1/admin/tag-management/pools/assigned-pool/reservations', [
            'quantity' => 1,
        ], [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000004',
        ])->assertCreated();
    }

    public function test_codec_failure_keeps_the_job_reserved_and_the_same_idempotency_request_resumes_without_duplicate_allocations(): void
    {
        $user = $this->createUser('platform-admin');
        $pool = $this->createPool();
        $codec = new class implements TagCodecClient {
            public int $batchCalls = 0;

            public function encode(int $length, string $value): array
            {
                return (new FakeTagCodecClient())->encode($length, $value);
            }

            public function encodeBatch(int $length, array $values): array
            {
                $this->batchCalls++;
                if ($this->batchCalls === 1) {
                    throw new \RuntimeException('Synthetic codec outage.');
                }

                return (new FakeTagCodecClient())->encodeBatch($length, $values);
            }
        };
        $this->app->instance(TagCodecClient::class, $codec);
        $this->actingAs($user);
        $this->reauthenticate();
        $headers = ['Idempotency-Key' => '00000000-0000-4000-8000-000000000005'];

        $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", ['quantity' => 1], $headers)
            ->assertStatus(503);
        $this->assertDatabaseHas('allocation_jobs', ['status' => 'codec_failed', 'quantity' => 1]);
        $this->assertDatabaseHas('tag_allocations', ['decoded_value' => '60466176', 'status' => 'codec-pending', 'tag_id' => null]);
        $this->assertDatabaseCount('tag_allocations', 1);

        $response = $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", ['quantity' => 1], $headers)
            ->assertCreated()
            ->assertJsonPath('tags.0.id', '20980d')
            ->assertJsonPath('tags.0.codecVersion', 'TEST-S01');
        $this->assertDatabaseHas('allocation_jobs', ['id' => $response->json('job_id'), 'status' => 'completed']);
        $this->assertDatabaseHas('tag_allocations', ['decoded_value' => '60466176', 'tag_id' => '20980d', 'codec_version' => 'TEST-S01', 'status' => 'draft']);
        $this->assertDatabaseCount('tag_allocations', 1);
        self::assertSame(1, \App\Models\AuditEvent::query()
            ->where('action', 'tag_management.allocation.completed')
            ->count());

        $this->postJson("/api/v1/admin/tag-management/pools/{$pool->pool_id}/reservations", ['quantity' => 1], $headers)
            ->assertCreated()
            ->assertJsonPath('job_id', $response->json('job_id'));
        self::assertSame(2, $codec->batchCalls);
        self::assertSame(1, \App\Models\AuditEvent::query()
            ->where('action', 'tag_management.allocation.completed')
            ->count());
    }

    private function createUser(string $role): User
    {
        return User::query()->create([
            'email' => "{$role}-".uniqid().'@example.test',
            'password' => Hash::make('correct-password'),
            'role' => $role,
            'is_active' => true,
        ]);
    }

    private function createPool(?string $organizationId = null, string $poolId = 'demo-pool'): AllocationPool
    {
        $range = TagRange::query()->create([
            'range_id' => "{$poolId}-range",
            'group_id' => 'demo-group',
            'length' => 6,
            'start_value' => '60466176',
            'end_value' => '60466275',
            'is_active' => true,
        ]);

        $pool = AllocationPool::query()->create([
            'pool_id' => $poolId,
            'organization_id' => $organizationId,
            'display_name' => 'Synthetic Pool',
            'channel' => 'test',
            'length' => 6,
            'policy_ref' => 'test-policy',
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
}
