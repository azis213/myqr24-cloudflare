<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AllocationJob;
use App\Models\AllocationPool;
use App\Models\Organization;
use App\Models\TagAllocation;
use App\Models\TagRange;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

final class TagLifecycleTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('security.email_mfa.enabled', false);
        config()->set('security.tag_management.reauth_ttl_seconds', 900);
    }

    public function test_platform_admin_can_transition_a_draft_tag_idempotently_and_audits_once(): void
    {
        $admin = $this->user('platform-admin');
        $tag = $this->tag();
        $this->actingAs($admin);
        $payload = ['targetStatus' => 'pending-review', 'reason' => 'initial-review'];
        $headers = ['Idempotency-Key' => '00000000-0000-4000-8000-000000000201'];

        $this->postJson("/api/v1/admin/tag-management/tags/{$tag->tag_id}/transitions", $payload, $headers)
            ->assertOk()
            ->assertJsonPath('tag.tagId', $tag->tag_id)
            ->assertJsonPath('tag.status', 'pending-review');
        $this->postJson("/api/v1/admin/tag-management/tags/{$tag->tag_id}/transitions", $payload, $headers)->assertOk();

        $this->assertDatabaseHas('tag_allocations', ['id' => $tag->id, 'status' => 'pending-review']);
        $this->assertDatabaseCount('idempotency_records', 1);
        $this->assertDatabaseCount('audit_events', 1);
        $this->assertDatabaseHas('audit_events', ['object_type' => 'tag_allocation', 'object_id' => $tag->id, 'action' => 'tag.lifecycle.transitioned']);
    }

    public function test_ready_to_publish_requires_recent_reauthentication_and_rejects_active(): void
    {
        $admin = $this->user('platform-admin');
        $tag = $this->tag('pending-review');
        $this->actingAs($admin);

        $this->postJson("/api/v1/admin/tag-management/tags/{$tag->tag_id}/transitions", [
            'targetStatus' => 'ready-to-publish', 'reason' => 'review-approved',
        ], ['Idempotency-Key' => '00000000-0000-4000-8000-000000000202'])->assertForbidden();

        $this->reauthenticate();
        $this->postJson("/api/v1/admin/tag-management/tags/{$tag->tag_id}/transitions", [
            'targetStatus' => 'ready-to-publish', 'reason' => 'review-approved',
        ], ['Idempotency-Key' => '00000000-0000-4000-8000-000000000203'])->assertOk();
        $this->postJson("/api/v1/admin/tag-management/tags/{$tag->tag_id}/transitions", [
            'targetStatus' => 'active', 'reason' => 'must-not-publish',
        ], ['Idempotency-Key' => '00000000-0000-4000-8000-000000000204'])->assertUnprocessable();
        $this->assertDatabaseHas('tag_allocations', ['id' => $tag->id, 'status' => 'ready-to-publish']);
    }

    public function test_operator_can_submit_only_an_assigned_draft_tag_and_idempotency_mismatch_conflicts(): void
    {
        $organization = Organization::query()->create(['display_name' => 'Synthetic Organization', 'is_active' => true]);
        $operator = $this->user('organization-operator');
        $organization->users()->attach($operator->id, ['role' => 'allocation-operator']);
        $tag = $this->tag('draft', $organization->id, 'opert1');
        $this->actingAs($operator);
        $headers = ['Idempotency-Key' => '00000000-0000-4000-8000-000000000205'];

        $this->postJson("/api/v1/admin/tag-management/tags/{$tag->tag_id}/transitions", [
            'targetStatus' => 'pending-review', 'reason' => 'operator-submit',
        ], $headers)->assertOk();

        $this->assertDatabaseHas('tag_allocations', ['id' => $tag->id, 'status' => 'pending-review']);
    }

    public function test_same_key_with_a_changed_authorized_transition_request_conflicts(): void
    {
        $admin = $this->user('platform-admin');
        $tag = $this->tag();
        $this->actingAs($admin);
        $headers = ['Idempotency-Key' => '00000000-0000-4000-8000-000000000206'];

        $this->postJson("/api/v1/admin/tag-management/tags/{$tag->tag_id}/transitions", [
            'targetStatus' => 'pending-review', 'reason' => 'initial-review',
        ], $headers)->assertOk();
        $this->reauthenticate();
        $this->postJson("/api/v1/admin/tag-management/tags/{$tag->tag_id}/transitions", [
            'targetStatus' => 'ready-to-publish', 'reason' => 'review-approved',
        ], $headers)->assertConflict();
    }

    private function user(string $role): User
    {
        return User::query()->create(['email' => "{$role}-".uniqid().'@example.test', 'password' => Hash::make('correct-password'), 'role' => $role, 'is_active' => true]);
    }

    private function tag(string $status = 'draft', ?string $organizationId = null, string $tagId = 'taglif'): TagAllocation
    {
        $range = TagRange::query()->create(['range_id' => "{$tagId}-range", 'group_id' => 'synthetic-group', 'length' => 6, 'start_value' => '100000', 'end_value' => '100099', 'is_active' => true]);
        $pool = AllocationPool::query()->create(['pool_id' => "{$tagId}-pool", 'organization_id' => $organizationId, 'display_name' => 'Synthetic Pool', 'channel' => 'test', 'length' => 6, 'policy_ref' => 'synthetic-policy', 'capacity_warning_threshold' => 1, 'is_active' => true]);
        $pool->ranges()->attach($range->id);
        $job = AllocationJob::query()->create(['pool_id' => $pool->id, 'actor_id' => $this->user('platform-admin')->id, 'organization_id' => $organizationId, 'quantity' => 1, 'status' => 'reserved', 'reserved_values' => ['100000']]);

        return TagAllocation::query()->create(['pool_id' => $pool->id, 'range_id' => $range->id, 'organization_id' => $organizationId, 'length' => 6, 'decoded_value' => '100000', 'tag_id' => $tagId, 'codec_version' => 'TEST-S01', 'status' => $status, 'allocation_job_id' => $job->id]);
    }

    private function reauthenticate(): void
    {
        $this->postJson('/api/v1/auth/tag-management/reauthenticate', ['password' => 'correct-password'])->assertOk();
    }
}