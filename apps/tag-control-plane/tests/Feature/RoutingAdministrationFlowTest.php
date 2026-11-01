<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AllocationJob;
use App\Models\AuditEvent;
use App\Models\AllocationPool;
use App\Models\FeatureDefinition;
use App\Models\TagAllocation;
use App\Models\TagGroup;
use App\Models\TagRange;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

final class RoutingAdministrationFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        config()->set('security.email_mfa.enabled', false);
    }

    public function test_feature_commands_require_reauthentication_validate_v1_and_are_idempotent(): void
    {
        $this->actingAs($this->admin());
        $definition = ['id' => 'redirect-demo', 'type' => 'redirect', 'enabled' => true, 'urlTemplate' => 'https://app.example.invalid/tag/{tagId}', 'status' => 302];
        $this->putJson('/api/v1/admin/routing/features/redirect-demo', ['definition' => $definition], ['Idempotency-Key' => (string) Str::uuid()])->assertForbidden();
        $this->reauthenticate();
        $key = (string) Str::uuid();
        $this->putJson('/api/v1/admin/routing/features/redirect-demo', ['definition' => $definition], ['Idempotency-Key' => $key])
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('feature.id', 'redirect-demo');
        $this->putJson('/api/v1/admin/routing/features/redirect-demo', ['definition' => $definition], ['Idempotency-Key' => $key])->assertOk();
        $this->putJson('/api/v1/admin/routing/features/redirect-demo', ['definition' => [...$definition, 'status' => 307]], ['Idempotency-Key' => $key])->assertConflict();
        $this->putJson('/api/v1/admin/routing/features/vault-demo', ['definition' => ['id' => 'vault-demo', 'type' => 'tag-vault', 'enabled' => true]], ['Idempotency-Key' => (string) Str::uuid()])->assertUnprocessable();
        $this->assertDatabaseCount('feature_definitions', 1);
        self::assertSame(1, AuditEvent::query()->where('action', 'routing.feature.saved')->count());
        $this->assertDatabaseCount('idempotency_records', 1);
    }

    public function test_all_four_assignment_levels_and_catalog_use_tcp_confirmed_targets(): void
    {
        $admin = $this->admin();
        $this->feature();
        [, $pool, $tag] = $this->fixture();
        $this->actingAs($admin);
        $this->reauthenticate();
        foreach (['group' => 'group-default', 'range' => 'range-six', 'pool' => $pool->pool_id, 'tag' => $tag->tag_id] as $scope => $target) {
            $this->putJson("/api/v1/admin/routing/assignments/{$scope}/{$target}", ['featureIds' => ['redirect-demo']], ['Idempotency-Key' => (string) Str::uuid()])
                ->assertOk()->assertJsonPath('assignment.scope', $scope)->assertJsonPath('assignment.targetId', $target);
        }
        $this->getJson('/api/v1/admin/routing/catalog')->assertOk()
            ->assertJsonPath('environment', 'staging')->assertJsonCount(4, 'assignments')
            ->assertJsonPath('supportedFeatureTypes.0', 'redirect');
        $this->assertDatabaseHas('tag_groups', ['group_id' => 'group-default']);
        $this->assertDatabaseCount('routing_feature_assignments', 3);
    }

    public function test_publish_endpoint_returns_completed_fake_outbox_and_replays_without_new_effects(): void
    {
        $this->feature();
        $this->fixture();
        TagGroup::query()->create(['group_id' => 'group-default', 'feature_ids' => ['redirect-demo']]);
        $this->actingAs($this->admin());
        $this->reauthenticate();
        $key = (string) Str::uuid();
        $headers = ['Idempotency-Key' => $key];
        $this->postJson('/api/v1/admin/routing/projection/publish', [], $headers)
            ->assertOk()->assertJsonPath('status', 'completed')->assertJsonPath('environment', 'staging')->assertJsonPath('attemptCount', 1);
        $this->postJson('/api/v1/admin/routing/projection/publish', [], $headers)
            ->assertOk()->assertJsonPath('status', 'completed')->assertJsonPath('attemptCount', 1);
        $this->assertDatabaseCount('routing_projection_revisions', 1);
        $this->assertDatabaseCount('routing_outbox_events', 1);
    }

    public function test_non_platform_roles_cannot_read_the_global_routing_catalog(): void
    {
        $user = User::query()->create(['email' => 'org@example.test', 'password' => Hash::make('correct-password'), 'role' => 'organization-admin', 'is_active' => true]);
        $this->actingAs($user)->getJson('/api/v1/admin/routing/catalog')->assertForbidden();
    }

    private function admin(): User
    {
        return User::query()->create(['email' => 'routing-'.uniqid().'@example.test', 'password' => Hash::make('correct-password'), 'role' => 'platform-admin', 'is_active' => true]);
    }

    private function feature(): void
    {
        FeatureDefinition::query()->create(['feature_id' => 'redirect-demo', 'definition' => ['id' => 'redirect-demo', 'type' => 'redirect', 'enabled' => true, 'url' => 'https://example.invalid/demo']]);
    }

    private function fixture(): array
    {
        $range = TagRange::query()->create(['range_id' => 'range-six', 'group_id' => 'group-default', 'length' => 6, 'start_value' => '60466176', 'end_value' => '60466177', 'is_active' => true]);
        $pool = AllocationPool::query()->create(['pool_id' => 'pool-six', 'display_name' => 'Synthetic', 'channel' => 'test', 'length' => 6, 'policy_ref' => 'synthetic', 'is_active' => true]);
        $pool->ranges()->attach($range->id);
        $actor = $this->admin();
        $job = AllocationJob::query()->create(['pool_id' => $pool->id, 'actor_id' => $actor->id, 'quantity' => 1, 'status' => 'reserved', 'reserved_values' => ['60466176']]);
        $tag = TagAllocation::query()->create(['pool_id' => $pool->id, 'range_id' => $range->id, 'length' => 6, 'decoded_value' => '60466176', 'tag_id' => 'tag001', 'status' => 'ready-to-publish', 'allocation_job_id' => $job->id]);
        return [$range, $pool, $tag];
    }

    private function reauthenticate(): void
    {
        $this->postJson('/api/v1/auth/tag-management/reauthenticate', ['password' => 'correct-password'])->assertOk();
    }
}
