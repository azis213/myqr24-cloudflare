<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class RoutingOutboxEvent extends Model
{
    use HasUuids;

    protected $fillable = ['projection_revision_id', 'environment', 'operation', 'documents', 'previous_documents', 'diff', 'status', 'attempt_count', 'last_error_class', 'correlation_id', 'available_at', 'published_at'];

    protected function casts(): array
    {
        return [
            'documents' => 'array', 'previous_documents' => 'array', 'diff' => 'array',
            'attempt_count' => 'integer', 'available_at' => 'immutable_datetime', 'published_at' => 'immutable_datetime',
        ];
    }

    public function revision(): BelongsTo
    {
        return $this->belongsTo(RoutingProjectionRevision::class, 'projection_revision_id');
    }
}
