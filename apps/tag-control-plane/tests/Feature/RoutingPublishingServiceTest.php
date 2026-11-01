<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\FeatureDefinition;
use App\Models\RoutingFeatureAssignment;
use App\Models\TagGroup;
use App\Models\TagRange;
use App\Models\User;
use App\Services\FakeRoutingProjectionPublisher;
use App\Services\RoutingProjectionPublisher;
use App\Services\RoutingPublishingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use InvalidArgumentException;
use Tests\TestCase;

final class RoutingPublishingServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_publish_persists_revision_outbox_audit_and_a_stable_diff(): void
    {
        $this->fixture();
        $service = app(RoutingPublishingService::class);
        $created = $service->create('publish', $this->admin(), '00000000-0000-4000-8000-000000000401');
        self::assertSame('pending', $created['status']);
        $this->assertDatabaseCount('routing_projection_revisions', 1);
        $this->assertDatabaseCount('routing_outbox_events', 1);
        $this->assertDatabaseHas('audit_events', ['action' => 'routing.publish.requested']);

        $completed = $service->process($created['eventId']);
        self::assertSame('completed', $completed['status']);
        self::assertSame(1, $completed['attemptCount']);
        $this->assertDatabaseHas('routing_projection_revisions', ['id' => $created['projectionRevision'], 'status' => 'completed']);
        $this->assertDatabaseHas('audit_events', ['action' => 'routing.publish.completed']);
        $preview = $service->preview();
        self::assertSame($created['projectionRevision'], $preview['baseRevision']);
        self::assertSame([], $preview['diff']);
        self::assertArrayHasKey('tag-range-index', app(RoutingProjectionPublisher::class)->documents());
    }

    public function test_invalid_projection_creates_neither_revision_outbox_nor_audit(): void
    {
        TagRange::query()->create(['range_id' => 'broken-range', 'group_id' => 'missing-group', 'length' => 6, 'start_value' => '60466176', 'end_value' => '60466177', 'is_active' => true]);
        try {
            app(RoutingPublishingService::class)->create('publish', $this->admin(), '00000000-0000-4000-8000-000000000402');
            self::fail('Invalid projection was accepted.');
        } catch (InvalidArgumentException) {
        }
        $this->assertDatabaseCount('routing_projection_revisions', 0);
        $this->assertDatabaseCount('routing_outbox_events', 0);
        $this->assertDatabaseCount('audit_events', 0);
    }

    public function test_retry_is_normalized_and_does_not_repeat_completed_provider_effects(): void
    {
        $this->fixture();
        $service = app(RoutingPublishingService::class);
        $fake = app(RoutingProjectionPublisher::class);
        self::assertInstanceOf(FakeRoutingProjectionPublisher::class, $fake);
        $fake->failNext('rate_limit');
        $created = $service->create('publish', $this->admin(), '00000000-0000-4000-8000-000000000403');
        $failed = $service->process($created['eventId']);
        self::assertSame('retryable', $failed['status']);
        self::assertSame('rate_limit', $failed['errorClass']);
        self::assertSame(1, $failed['attemptCount']);
        try {
            $service->create('publish', $this->admin(), '00000000-0000-4000-8000-000000000404');
            self::fail('A second open outbox event was accepted.');
        } catch (InvalidArgumentException) {
        }

        $service->prepareRetry($created['eventId'], $this->admin(), '00000000-0000-4000-8000-000000000405');
        $completed = $service->process($created['eventId']);
        self::assertSame('completed', $completed['status']);
        self::assertSame(2, $completed['attemptCount']);
        $operationCount = count($fake->operations());
        $replayed = $service->process($created['eventId']);
        self::assertSame(2, $replayed['attemptCount']);
        self::assertCount($operationCount, $fake->operations());
    }

    public function test_processing_claim_is_not_applied_twice(): void
    {
        $this->fixture();
        $service = app(RoutingPublishingService::class);
        $created = $service->create('publish', $this->admin(), '00000000-0000-4000-8000-000000000409');
        \App\Models\RoutingOutboxEvent::query()->findOrFail($created['eventId'])->update(['status' => 'processing']);
        $result = $service->process($created['eventId']);
        self::assertSame('processing', $result['status']);
        self::assertSame(0, $result['attemptCount']);
        self::assertCount(0, app(RoutingProjectionPublisher::class)->operations());
    }

    public function test_production_configuration_is_refused_without_outbox(): void
    {
        $this->fixture();
        config()->set('security.routing_publisher.environment', 'production');
        try {
            app(RoutingPublishingService::class)->create('publish', $this->admin(), '00000000-0000-4000-8000-000000000406');
            self::fail('Production fake publishing was accepted.');
        } catch (InvalidArgumentException) {
        }
        $this->assertDatabaseCount('routing_projection_revisions', 0);
        $this->assertDatabaseCount('routing_outbox_events', 0);
    }

    public function test_unpublish_neutralizes_index_before_deleting_rules_and_finishes_empty(): void
    {
        $range = $this->fixture();
        RoutingFeatureAssignment::query()->create(['scope' => 'range', 'range_id' => $range->id, 'feature_ids' => ['redirect-demo']]);
        $service = app(RoutingPublishingService::class);
        $admin = $this->admin();
        $published = $service->create('publish', $admin, '00000000-0000-4000-8000-000000000407');
        $service->process($published['eventId']);
        $fake = app(RoutingProjectionPublisher::class);
        $offset = count($fake->operations());
        $unpublished = $service->create('unpublish', $admin, '00000000-0000-4000-8000-000000000408');
        $service->process($unpublished['eventId']);
        $operations = array_slice($fake->operations(), $offset);

        self::assertSame(['action' => 'put', 'environment' => 'staging', 'key' => 'tag-range-index'], $operations[0]);
        self::assertSame('tag-range-index', $operations[array_key_last($operations)]['key']);
        $deleteRange = array_search('range-rule:range-six', array_column($operations, 'key'), true);
        $deleteFeature = array_search('feature:redirect-demo', array_column($operations, 'key'), true);
        self::assertNotFalse($deleteRange);
        self::assertNotFalse($deleteFeature);
        self::assertLessThan($deleteFeature, $deleteRange);
        self::assertSame(['tag-range-index' => ['version' => 1, 'ranges' => []]], $fake->documents());
        $this->assertDatabaseHas('routing_projection_revisions', ['id' => $unpublished['projectionRevision'], 'status' => 'completed', 'operation' => 'unpublish']);
    }

    private function fixture(): TagRange
    {
        FeatureDefinition::query()->create(['feature_id' => 'redirect-demo', 'definition' => ['id' => 'redirect-demo', 'type' => 'redirect', 'enabled' => true, 'url' => 'https://example.invalid/demo']]);
        TagGroup::query()->create(['group_id' => 'group-default', 'feature_ids' => ['redirect-demo']]);
        return TagRange::query()->create(['range_id' => 'range-six', 'group_id' => 'group-default', 'length' => 6, 'start_value' => '60466176', 'end_value' => '60466177', 'is_active' => true]);
    }

    private function admin(): User
    {
        return User::query()->create(['email' => 'publisher-'.uniqid().'@example.test', 'password' => Hash::make('correct-password'), 'role' => 'platform-admin', 'is_active' => true]);
    }
}
