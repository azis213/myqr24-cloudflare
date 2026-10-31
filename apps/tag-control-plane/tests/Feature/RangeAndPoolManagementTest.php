<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AllocationPool;
use App\Models\Organization;
use App\Models\TagRange;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class RangeAndPoolManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('security.email_mfa.enabled', false);
        config()->set('security.tag_management.reauth_ttl_seconds', 900);
    }

    public function test_platform_admin_requires_reauthentication_and_can_create_a_canonical_range(): void
    {
        $admin = $this->platformAdmin();
        $this->actingAs($admin);

        $range = [
            'rangeId' => 'range-6-001',
            'groupId' => 'group-001',
            'length' => 6,
            'startValue' => '1679616',
            'endValue' => '1679715',
            'active' => true,
        ];

        $headers = ['Idempotency-Key' => '00000000-0000-4000-8000-000000000101'];

        $this->postJson('/api/v1/admin/tag-management/ranges', $range, $headers)
            ->assertForbidden();

        $this->reauthenticate();

        $this->postJson('/api/v1/admin/tag-management/ranges', $range, $headers)
            ->assertCreated()
            ->assertJsonPath('range.rangeId', 'range-6-001')
            ->assertJsonPath('range.startValue', '1679616');

        $this->assertDatabaseHas('tag_ranges', [
            'range_id' => 'range-6-001',
            'length' => 6,
            'start_value' => '1679616',
            'end_value' => '1679715',
        ]);

        $this->postJson('/api/v1/admin/tag-management/ranges', $range, $headers)
            ->assertCreated()
            ->assertJsonPath('range.rangeId', 'range-6-001');

        $this->assertDatabaseCount('tag_ranges', 1);
    }

    public function test_range_rejects_overlap_and_noncanonical_domain_values(): void
    {
        $admin = $this->platformAdmin();
        $this->actingAs($admin);
        $this->reauthenticate();

        $this->postJson('/api/v1/admin/tag-management/ranges', [
            'rangeId' => 'range-6-001',
            'groupId' => 'group-001',
            'length' => 6,
            'startValue' => '60466176',
            'endValue' => '60466275',
            'active' => true,
        ], ['Idempotency-Key' => '00000000-0000-4000-8000-000000000102'])->assertCreated();

        $this->postJson('/api/v1/admin/tag-management/ranges', [
            'rangeId' => 'range-6-overlap',
            'groupId' => 'group-001',
            'length' => 6,
            'startValue' => '60466200',
            'endValue' => '60466180',
            'active' => true,
        ], ['Idempotency-Key' => '00000000-0000-4000-8000-000000000103'])->assertUnprocessable();

        $this->postJson('/api/v1/admin/tag-management/ranges', [
            'rangeId' => 'range-8-invalid',
            'groupId' => 'group-001',
            'length' => 8,
            'startValue' => '1',
            'endValue' => '99',
            'active' => true,
        ], ['Idempotency-Key' => '00000000-0000-4000-8000-000000000104'])->assertUnprocessable();

        $this->postJson('/api/v1/admin/tag-management/ranges', [
            'rangeId' => 'range-6-below-lower-bound',
            'groupId' => 'group-001',
            'length' => 6,
            'startValue' => '1679615',
            'endValue' => '1679615',
            'active' => true,
        ], ['Idempotency-Key' => '00000000-0000-4000-8000-000000000108'])->assertUnprocessable();

        $this->assertDatabaseCount('tag_ranges', 1);
    }

    public function test_platform_admin_can_create_a_pool_only_from_active_ranges_of_the_same_length(): void
    {
        $admin = $this->platformAdmin();
        $this->actingAs($admin);
        $this->reauthenticate();

        $this->postJson('/api/v1/admin/tag-management/ranges', [
            'rangeId' => 'range-6-001',
            'groupId' => 'group-001',
            'length' => 6,
            'startValue' => '60466176',
            'endValue' => '60466275',
            'active' => true,
        ], ['Idempotency-Key' => '00000000-0000-4000-8000-000000000105'])->assertCreated();

        $pool = [
            'poolId' => 'pool-6-001',
            'organizationId' => null,
            'displayName' => 'Synthetic Pool',
            'channel' => 'test',
            'length' => 6,
            'rangeIds' => ['range-6-001'],
            'policyRef' => 'synthetic-policy',
            'capacityWarningThreshold' => 10,
            'active' => true,
        ];

        $this->postJson('/api/v1/admin/tag-management/pools', $pool, [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000106',
        ])
            ->assertCreated()
            ->assertJsonPath('pool.poolId', 'pool-6-001')
            ->assertJsonPath('pool.rangeIds.0', 'range-6-001');

        $pool['poolId'] = 'pool-8-invalid';
        $pool['length'] = 8;

        $this->postJson('/api/v1/admin/tag-management/pools', $pool, [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000107',
        ])
            ->assertUnprocessable();

        $this->assertDatabaseCount('allocation_pools', 1);
    }

    public function test_platform_admin_can_update_a_range_idempotently_and_cannot_deactivate_it_while_an_active_pool_references_it(): void
    {
        $admin = $this->platformAdmin();
        $range = $this->range('range-6-update');
        $pool = $this->pool($range);
        $this->actingAs($admin);

        $payload = [
            'rangeId' => $range->range_id,
            'groupId' => 'group-updated',
            'length' => 6,
            'startValue' => '60466276',
            'endValue' => '60466375',
            'active' => true,
        ];
        $headers = ['Idempotency-Key' => '00000000-0000-4000-8000-000000000108'];

        $this->patchJson("/api/v1/admin/tag-management/ranges/{$range->range_id}", $payload, $headers)->assertForbidden();
        $this->reauthenticate();
        $this->patchJson("/api/v1/admin/tag-management/ranges/{$range->range_id}", $payload, $headers)
            ->assertOk()->assertJsonPath('range.groupId', 'group-updated');
        $this->patchJson("/api/v1/admin/tag-management/ranges/{$range->range_id}", $payload, $headers)->assertOk();
        $this->assertDatabaseCount('idempotency_records', 1);
        $this->assertDatabaseHas('audit_events', ['object_type' => 'tag_range', 'object_id' => $range->id, 'action' => 'tag_range.updated']);

        $payload['active'] = false;
        $this->patchJson("/api/v1/admin/tag-management/ranges/{$range->range_id}", $payload, [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000109',
        ])->assertUnprocessable();
        $this->assertDatabaseHas('allocation_pools', ['id' => $pool->id, 'is_active' => true]);
    }

    public function test_pool_update_enforces_organization_scope_and_immutable_identity(): void
    {
        $organization = Organization::query()->create(['display_name' => 'Synthetic Organization', 'is_active' => true]);
        $range = $this->range('range-6-organization');
        $pool = $this->pool($range, $organization->id, 'organization-pool');
        $organizationAdmin = User::query()->create(['email' => 'organization-admin@example.test', 'password' => Hash::make('correct-password'), 'role' => 'organization-admin', 'is_active' => true]);
        $organization->users()->attach($organizationAdmin->id, ['role' => 'organization-admin']);
        $this->actingAs($organizationAdmin);
        $this->reauthenticate();

        $payload = $this->poolPayload($pool, $range);
        $payload['displayName'] = 'Updated organization pool';
        $this->patchJson('/api/v1/admin/tag-management/pools/organization-pool', $payload, [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000110',
        ])->assertOk()->assertJsonPath('pool.poolId', 'organization-pool');

        $payload['organizationId'] = null;
        $this->patchJson('/api/v1/admin/tag-management/pools/organization-pool', $payload, [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000111',
        ])->assertUnprocessable();
        $this->assertDatabaseHas('audit_events', ['object_type' => 'allocation_pool', 'object_id' => $pool->id, 'action' => 'allocation_pool.updated']);
    }

    public function test_organization_admin_cannot_create_or_update_a_foreign_or_platform_pool(): void
    {
        $organization = Organization::query()->create(['display_name' => 'Assigned Organization', 'is_active' => true]);
        $otherOrganization = Organization::query()->create(['display_name' => 'Other Organization', 'is_active' => true]);
        $range = $this->range('range-6-organization-scope');
        $assignedPool = $this->pool($range, $organization->id, 'assigned-organization-pool');
        $foreignPool = $this->pool($range, $otherOrganization->id, 'foreign-organization-pool');
        $platformPool = $this->pool($range, null, 'platform-pool');
        $organizationAdmin = User::query()->create(['email' => 'organization-scope-admin@example.test', 'password' => Hash::make('correct-password'), 'role' => 'organization-admin', 'is_active' => true]);
        $organization->users()->attach($organizationAdmin->id, ['role' => 'organization-admin']);
        $this->actingAs($organizationAdmin);
        $this->reauthenticate();

        $this->getJson('/api/v1/admin/tag-management/pools')
            ->assertOk()
            ->assertJsonCount(1, 'pools')
            ->assertJsonPath('pools.0.poolId', $assignedPool->pool_id);

        $this->patchJson("/api/v1/admin/tag-management/pools/{$foreignPool->pool_id}", $this->poolPayload($foreignPool, $range), [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000112',
        ])->assertForbidden();
        $this->patchJson("/api/v1/admin/tag-management/pools/{$platformPool->pool_id}", $this->poolPayload($platformPool, $range), [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000113',
        ])->assertForbidden();

        $newPool = $this->poolPayload($assignedPool, $range);
        $newPool['poolId'] = 'attempted-foreign-pool';
        $newPool['organizationId'] = $otherOrganization->id;
        $this->postJson('/api/v1/admin/tag-management/pools', $newPool, [
            'Idempotency-Key' => '00000000-0000-4000-8000-000000000114',
        ])->assertForbidden();
        $this->assertDatabaseMissing('allocation_pools', ['pool_id' => 'attempted-foreign-pool']);
    }

    private function platformAdmin(): User
    {
        return User::query()->create([
            'email' => 'range-admin@example.test',
            'password' => Hash::make('correct-password'),
            'role' => 'platform-admin',
            'is_active' => true,
        ]);
    }

    private function reauthenticate(): void
    {
        $this->postJson('/api/v1/auth/tag-management/reauthenticate', [
            'password' => 'correct-password',
        ])->assertOk();
    }

    private function range(string $rangeId): TagRange
    {
        return TagRange::query()->create(['range_id' => $rangeId, 'group_id' => 'group-001', 'length' => 6, 'start_value' => '60466176', 'end_value' => '60466275', 'is_active' => true]);
    }

    private function pool(TagRange $range, ?string $organizationId = null, string $poolId = 'pool-update'): AllocationPool
    {
        $pool = AllocationPool::query()->create(['pool_id' => $poolId, 'organization_id' => $organizationId, 'display_name' => 'Synthetic Pool', 'channel' => 'test', 'length' => 6, 'policy_ref' => 'synthetic-policy', 'capacity_warning_threshold' => 10, 'is_active' => true]);
        $pool->ranges()->attach($range->id);
        return $pool;
    }

    private function poolPayload(AllocationPool $pool, TagRange $range): array
    {
        return ['poolId' => $pool->pool_id, 'organizationId' => $pool->organization_id, 'displayName' => $pool->display_name, 'channel' => $pool->channel, 'length' => $pool->length, 'rangeIds' => [$range->range_id], 'policyRef' => $pool->policy_ref, 'capacityWarningThreshold' => $pool->capacity_warning_threshold, 'active' => $pool->is_active];
    }
}
