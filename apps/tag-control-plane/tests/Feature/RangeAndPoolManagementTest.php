<?php

declare(strict_types=1);

namespace Tests\Feature;

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
            'startValue' => '60466176',
            'endValue' => '60466275',
            'active' => true,
        ];

        $headers = ['Idempotency-Key' => '00000000-0000-4000-8000-000000000101'];

        $this->postJson('/api/v1/admin/tag-management/ranges', $range, $headers)
            ->assertForbidden();

        $this->reauthenticate();

        $this->postJson('/api/v1/admin/tag-management/ranges', $range, $headers)
            ->assertCreated()
            ->assertJsonPath('range.rangeId', 'range-6-001')
            ->assertJsonPath('range.startValue', '60466176');

        $this->assertDatabaseHas('tag_ranges', [
            'range_id' => 'range-6-001',
            'length' => 6,
            'start_value' => '60466176',
            'end_value' => '60466275',
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
}
