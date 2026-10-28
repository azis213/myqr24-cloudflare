<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\AuditEvent;
use App\Services\AuditService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

final class AuditServiceMySqlTest extends TestCase
{
    use RefreshDatabase;

    public function test_audit_service_persists_redacted_metadata_with_the_requested_correlation_id(): void
    {
        $correlationId = '188fe9fc-5938-442e-9f3d-7f31c0fd3baa';

        $event = app(AuditService::class)->record(
            correlationId: $correlationId,
            actorType: 'system-process',
            actorId: 'local-test-runner',
            objectType: 'tag',
            objectId: 'local-tag-001',
            action: 'tag.reservation.requested',
            metadata: [
                'request_source' => 'local-test',
                'claim_pin' => '123456',
                'nested' => [
                    'authorization' => 'Bearer must-not-persist',
                    'visible_value' => 'retained',
                ],
            ],
        );

        $this->assertDatabaseHas('audit_events', [
            'id' => $event->id,
            'correlation_id' => $correlationId,
            'actor_type' => 'system-process',
            'actor_id' => 'local-test-runner',
            'object_type' => 'tag',
            'object_id' => 'local-tag-001',
            'action' => 'tag.reservation.requested',
        ]);

        $persisted = AuditEvent::query()->findOrFail($event->id);

        self::assertSame($correlationId, $persisted->correlation_id);
        self::assertSame('[redacted]', $persisted->metadata['claim_pin']);
        self::assertSame('[redacted]', $persisted->metadata['nested']['authorization']);
        self::assertSame('retained', $persisted->metadata['nested']['visible_value']);
        self::assertSame('UTC', $persisted->occurred_at->getTimezone()->getName());
    }

    public function test_audit_record_is_rolled_back_when_the_enclosing_mutation_fails(): void
    {
        try {
            DB::transaction(function (): void {
                app(AuditService::class)->record(
                    correlationId: 'add1dd4b-59f4-4e66-ad89-633d7ff6dbbf',
                    actorType: 'system-process',
                    actorId: 'local-test-runner',
                    objectType: 'tag',
                    objectId: 'local-tag-rollback',
                    action: 'tag.reservation.requested',
                );

                throw new RuntimeException('Simulated mutation failure.');
            });
        } catch (RuntimeException $exception) {
            self::assertSame('Simulated mutation failure.', $exception->getMessage());
        }

        $this->assertDatabaseMissing('audit_events', [
            'object_id' => 'local-tag-rollback',
        ]);
    }

    public function test_audit_service_rejects_an_invalid_correlation_id_before_persisting(): void
    {
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('The correlation ID must be a UUID.');

        app(AuditService::class)->record(
            correlationId: 'invalid-correlation-id',
            actorType: 'system-process',
            actorId: 'local-test-runner',
            objectType: 'tag',
            objectId: 'local-tag-invalid-correlation',
            action: 'tag.reservation.requested',
        );
    }
}
