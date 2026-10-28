<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AuditEvent;
use App\Support\AuditSanitizer;
use Illuminate\Support\Str;
use InvalidArgumentException;

final class AuditService
{
    public function record(
        string $correlationId,
        string $actorType,
        string $actorId,
        string $objectType,
        string $objectId,
        string $action,
        array $metadata = [],
    ): AuditEvent {
        if (! Str::isUuid($correlationId)) {
            throw new InvalidArgumentException('The correlation ID must be a UUID.');
        }

        return AuditEvent::query()->create([
            'correlation_id' => $correlationId,
            'actor_type' => $actorType,
            'actor_id' => $actorId,
            'object_type' => $objectType,
            'object_id' => $objectId,
            'action' => $action,
            'metadata' => AuditSanitizer::sanitize($metadata),
        ]);
    }
}
