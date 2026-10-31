<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\FeatureDefinition;
use App\Models\TagGroup;
use App\Models\TagRange;
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
}
