<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AllocationJob;
use App\Models\AllocationPool;
use App\Models\FeatureDefinition;
use App\Models\RoutingFeatureAssignment;
use App\Models\TagAllocation;
use App\Models\TagGroup;
use App\Models\TagRange;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use App\Services\RoutingProjectionService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use InvalidArgumentException;
use Tests\TestCase;

final class RoutingProjectionServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_generates_only_edge_contract_documents_in_global_decimal_order(): void
    {
        TagGroup::query()->create(['group_id' => 'group-default', 'feature_ids' => ['redirect-default']]);
        FeatureDefinition::query()->create(['feature_id' => 'redirect-default', 'definition' => ['id' => 'redirect-default', 'type' => 'redirect', 'enabled' => true, 'urlTemplate' => 'https://app.example.invalid/tag/{tagId}']]);
        TagRange::query()->create(['range_id' => 'range-ten', 'group_id' => 'group-default', 'length' => 10, 'start_value' => '101559956668416', 'end_value' => '101559956668417', 'is_active' => true]);
        TagRange::query()->create(['range_id' => 'range-six', 'group_id' => 'group-default', 'length' => 6, 'start_value' => '60466176', 'end_value' => '60466177', 'is_active' => true]);

        $documents = app(RoutingProjectionService::class)->generate();

        self::assertSame(['tag-range-index', 'group:group-default', 'feature:redirect-default'], array_keys($documents));
        self::assertSame(['range-six', 'range-ten'], array_column($documents['tag-range-index']['ranges'], 'id'));
        self::assertSame(['id' => 'group-default', 'featureIds' => ['redirect-default']], $documents['group:group-default']);
        self::assertSame('https://app.example.invalid/tag/{tagId}', $documents['feature:redirect-default']['urlTemplate']);
    }

    public function test_it_fails_closed_for_missing_references_unsafe_urls_and_private_feature_data(): void
    {
        TagGroup::query()->create(['group_id' => 'group-invalid', 'feature_ids' => ['missing-feature']]);
        TagRange::query()->create(['range_id' => 'range-invalid', 'group_id' => 'group-invalid', 'length' => 6, 'start_value' => '60466176', 'end_value' => '60466177', 'is_active' => true]);

        $this->expectException(InvalidArgumentException::class);
        app(RoutingProjectionService::class)->generate();
    }

    public function test_it_materializes_pool_and_tag_priority_without_pool_metadata(): void
    {
        foreach (['group', 'range', 'pool', 'tag'] as $name) {
            FeatureDefinition::query()->create(['feature_id' => 'redirect-'.$name, 'definition' => ['id' => 'redirect-'.$name, 'type' => 'redirect', 'enabled' => true, 'url' => 'https://example.invalid/'.$name]]);
        }
        TagGroup::query()->create(['group_id' => 'group-default', 'feature_ids' => ['redirect-group']]);
        $range = TagRange::query()->create(['range_id' => 'range-six', 'group_id' => 'group-default', 'length' => 6, 'start_value' => '60466176', 'end_value' => '60466177', 'is_active' => true]);
        $pool = AllocationPool::query()->create(['pool_id' => 'private-pool-identifier', 'display_name' => 'Private pool name', 'channel' => 'test', 'length' => 6, 'policy_ref' => 'private-policy', 'is_active' => true]);
        $pool->ranges()->attach($range->id);
        $actor = User::query()->create(['email' => 'projection@example.test', 'password' => Hash::make('password'), 'role' => 'platform-admin', 'is_active' => true]);
        $job = AllocationJob::query()->create(['pool_id' => $pool->id, 'actor_id' => $actor->id, 'quantity' => 2, 'status' => 'reserved', 'reserved_values' => ['60466176', '60466177']]);
        $first = TagAllocation::query()->create(['pool_id' => $pool->id, 'range_id' => $range->id, 'length' => 6, 'decoded_value' => '60466176', 'tag_id' => 'tag001', 'status' => 'ready-to-publish', 'allocation_job_id' => $job->id]);
        $second = TagAllocation::query()->create(['pool_id' => $pool->id, 'range_id' => $range->id, 'length' => 6, 'decoded_value' => '60466177', 'tag_id' => 'tag002', 'status' => 'ready-to-publish', 'allocation_job_id' => $job->id]);
        RoutingFeatureAssignment::query()->create(['scope' => 'range', 'range_id' => $range->id, 'feature_ids' => ['redirect-range']]);
        RoutingFeatureAssignment::query()->create(['scope' => 'pool', 'pool_id' => $pool->id, 'feature_ids' => ['redirect-pool']]);
        RoutingFeatureAssignment::query()->create(['scope' => 'tag', 'tag_allocation_id' => $first->id, 'feature_ids' => ['redirect-tag']]);

        $documents = app(RoutingProjectionService::class)->generate();

        self::assertSame(['redirect-tag'], $documents['tag:60466176']['featureIds']);
        self::assertSame(['redirect-pool'], $documents['tag:60466177']['featureIds']);
        self::assertSame(['redirect-range'], $documents['range-rule:range-six']['featureIds']);
        self::assertSame(['redirect-group'], $documents['group:group-default']['featureIds']);
        $serialized = json_encode($documents, JSON_THROW_ON_ERROR);
        self::assertStringNotContainsString('private-pool-identifier', $serialized);
        self::assertStringNotContainsString('Private pool name', $serialized);
        self::assertStringNotContainsString('private-policy', $serialized);
        self::assertArrayNotHasKey('pool:private-pool-identifier', $documents);
        self::assertNotNull($second);
    }

    public function test_it_rejects_feature_types_outside_the_v1_contract(): void
    {
        FeatureDefinition::query()->create(['feature_id' => 'vault-feature', 'definition' => ['id' => 'vault-feature', 'type' => 'tag-vault', 'enabled' => true]]);
        TagGroup::query()->create(['group_id' => 'group-default', 'feature_ids' => ['vault-feature']]);
        TagRange::query()->create(['range_id' => 'range-six', 'group_id' => 'group-default', 'length' => 6, 'start_value' => '60466176', 'end_value' => '60466177', 'is_active' => true]);

        $this->expectException(InvalidArgumentException::class);
        app(RoutingProjectionService::class)->generate();
    }
}
