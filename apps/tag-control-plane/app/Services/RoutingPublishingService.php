<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\RoutingOutboxEvent;
use App\Models\RoutingProjectionRevision;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class RoutingPublishingService
{
    public function __construct(
        private readonly RoutingProjectionService $projections,
        private readonly RoutingProjectionPublisher $publisher,
        private readonly AuditService $audit,
    ) {
    }

    public function preview(): array
    {
        $environment = $this->environment();
        $documents = $this->projections->generate();
        $previous = $this->lastRevision($environment);
        $before = $previous?->documents ?? [];
        return [
            'environment' => $environment,
            'baseRevision' => $previous?->id,
            'documents' => $documents,
            'diff' => $this->diff($before, $documents),
        ];
    }

    public function create(string $operation, User $user, string $correlationId): array
    {
        if (! in_array($operation, ['publish', 'unpublish'], true)) {
            throw new InvalidArgumentException('Unsupported publish operation.');
        }
        $environment = $this->environment();
        $this->assertStaging($environment);
        if (RoutingOutboxEvent::query()->where('environment', $environment)->whereIn('status', ['pending', 'processing', 'retryable'])->exists()) {
            throw new InvalidArgumentException('Complete or retry the open routing outbox event first.');
        }

        return DB::transaction(function () use ($operation, $environment, $user, $correlationId): array {
            $previous = $this->lastRevision($environment);
            $before = $previous?->documents ?? [];
            $documents = $operation === 'publish' ? $this->projections->generate() : [];
            $diff = $this->diff($before, $documents);
            $revision = RoutingProjectionRevision::query()->create([
                'environment' => $environment, 'operation' => $operation, 'documents' => $documents,
                'diff' => $diff, 'status' => 'pending', 'correlation_id' => $correlationId,
            ]);
            $event = RoutingOutboxEvent::query()->create([
                'projection_revision_id' => $revision->id, 'environment' => $environment, 'operation' => $operation,
                'documents' => $documents, 'previous_documents' => $before, 'diff' => $diff,
                'status' => 'pending', 'attempt_count' => 0, 'correlation_id' => $correlationId, 'available_at' => now(),
            ]);
            $this->audit->record($correlationId, 'user', $user->id, 'routing_projection', (string) $revision->id, 'routing.'.$operation.'.requested', ['eventId' => $event->id, 'changeCount' => count($diff)]);
            return $this->payload($event);
        });
    }

    public function prepareRetry(string $eventId, User $user, string $correlationId): array
    {
        return DB::transaction(function () use ($eventId, $user, $correlationId): array {
            $event = RoutingOutboxEvent::query()->lockForUpdate()->findOrFail($eventId);
            $this->assertStaging($event->environment);
            if (in_array($event->status, ['completed', 'pending', 'processing'], true)) {
                return $this->payload($event);
            }
            if ($event->status !== 'retryable') {
                throw new InvalidArgumentException('Outbox event cannot be retried.');
            }
            $event->update(['status' => 'pending', 'last_error_class' => null, 'available_at' => now()]);
            $this->audit->record($correlationId, 'user', $user->id, 'routing_outbox', $event->id, 'routing.publish.retry_requested', ['projectionRevision' => $event->projection_revision_id]);
            return $this->payload($event->refresh());
        });
    }

    public function process(string $eventId): array
    {
        $claim = DB::transaction(function () use ($eventId): array {
            $locked = RoutingOutboxEvent::query()->lockForUpdate()->findOrFail($eventId);
            if (in_array($locked->status, ['completed', 'processing'], true)) {
                return ['event' => $locked, 'claimed' => false];
            }
            $locked->update(['status' => 'processing', 'attempt_count' => $locked->attempt_count + 1, 'available_at' => now()]);
            return ['event' => $locked->refresh(), 'claimed' => true];
        });
        $event = $claim['event'];
        if (! $claim['claimed']) {
            return $this->payload($event);
        }

        try {
            $this->assertStaging($event->environment);
            $this->publisher->apply($event);
            $event = DB::transaction(function () use ($event): RoutingOutboxEvent {
                $locked = RoutingOutboxEvent::query()->lockForUpdate()->findOrFail($event->id);
                $locked->update(['status' => 'completed', 'last_error_class' => null, 'published_at' => now()]);
                $locked->revision()->update(['status' => 'completed']);
                $this->audit->record($locked->correlation_id, 'system', 'fake-publisher', 'routing_outbox', $locked->id, 'routing.'.$locked->operation.'.completed', ['projectionRevision' => $locked->projection_revision_id, 'attemptCount' => $locked->attempt_count]);
                return $locked->refresh();
            });
        } catch (RoutingPublisherException $exception) {
            $event = DB::transaction(function () use ($event, $exception): RoutingOutboxEvent {
                $locked = RoutingOutboxEvent::query()->lockForUpdate()->findOrFail($event->id);
                $locked->update(['status' => 'retryable', 'last_error_class' => $exception->errorClass, 'available_at' => now()]);
                $locked->revision()->update(['status' => 'retryable']);
                $this->audit->record($locked->correlation_id, 'system', 'fake-publisher', 'routing_outbox', $locked->id, 'routing.'.$locked->operation.'.failed', ['projectionRevision' => $locked->projection_revision_id, 'errorClass' => $exception->errorClass]);
                return $locked->refresh();
            });
        }

        return $this->payload($event);
    }

    public function outbox(): array
    {
        return RoutingOutboxEvent::query()->latest('id')->limit(50)->get()->map(fn (RoutingOutboxEvent $event): array => $this->payload($event))->values()->all();
    }

    public function payload(RoutingOutboxEvent $event): array
    {
        return [
            'eventId' => $event->id, 'projectionRevision' => $event->projection_revision_id,
            'environment' => $event->environment, 'operation' => $event->operation, 'status' => $event->status,
            'attemptCount' => $event->attempt_count, 'errorClass' => $event->last_error_class,
            'diff' => $event->diff, 'correlationId' => $event->correlation_id,
            'publishedAt' => $event->published_at?->toISOString(),
        ];
    }

    private function lastRevision(string $environment): ?RoutingProjectionRevision
    {
        return RoutingProjectionRevision::query()->where('environment', $environment)->where('status', 'completed')->orderByDesc('id')->first();
    }

    private function diff(array $before, array $after): array
    {
        $keys = array_values(array_unique([...array_keys($before), ...array_keys($after)]));
        sort($keys);
        $changes = [];
        foreach ($keys as $key) {
            $oldExists = array_key_exists($key, $before);
            $newExists = array_key_exists($key, $after);
            $old = $oldExists ? $before[$key] : null;
            $new = $newExists ? $after[$key] : null;
            if ($oldExists !== $newExists || $this->canonical($old) !== $this->canonical($new)) {
                $changes[] = ['key' => $key, 'change' => ! $oldExists ? 'added' : (! $newExists ? 'removed' : 'changed'), 'before' => $old, 'after' => $new];
            }
        }
        return $changes;
    }

    private function canonical(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        foreach ($value as $key => $entry) {
            $value[$key] = $this->canonical($entry);
        }
        if (! array_is_list($value)) {
            ksort($value);
        }
        return $value;
    }

    private function environment(): string
    {
        $environment = config('security.routing_publisher.environment');
        if (! is_string($environment)) {
            throw new InvalidArgumentException('Missing routing environment.');
        }
        return $environment;
    }

    private function assertStaging(string $environment): void
    {
        if ($environment !== 'staging') {
            throw new InvalidArgumentException('Only local staging publishing is allowed.');
        }
    }
}
