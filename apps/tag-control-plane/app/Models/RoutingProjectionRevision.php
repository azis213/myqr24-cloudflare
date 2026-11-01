<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

final class RoutingProjectionRevision extends Model
{
    protected $fillable = ['environment', 'operation', 'documents', 'diff', 'status', 'correlation_id'];

    protected function casts(): array
    {
        return ['documents' => 'array', 'diff' => 'array'];
    }
}
