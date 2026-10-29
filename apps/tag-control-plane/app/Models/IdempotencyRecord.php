<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class IdempotencyRecord extends Model
{
    use HasUuids;

    protected $fillable = [
        'actor_id',
        'command',
        'idempotency_key',
        'request_hash',
        'status',
        'response_payload',
        'allocation_job_id',
    ];

    protected function casts(): array
    {
        return [
            'response_payload' => 'array',
        ];
    }

    public function allocationJob(): BelongsTo
    {
        return $this->belongsTo(AllocationJob::class);
    }
}
