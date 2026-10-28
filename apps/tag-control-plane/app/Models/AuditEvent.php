<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class AuditEvent extends Model
{
    public const CREATED_AT = 'occurred_at';

    public const UPDATED_AT = null;

    protected $table = 'audit_events';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
            'occurred_at' => 'immutable_datetime',
        ];
    }
}
