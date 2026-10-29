<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class AllocationJob extends Model
{
    use HasUuids;

    protected $fillable = [
        'pool_id',
        'actor_id',
        'organization_id',
        'quantity',
        'status',
        'reserved_values',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'reserved_values' => 'array',
        ];
    }

    public function pool(): BelongsTo
    {
        return $this->belongsTo(AllocationPool::class, 'pool_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
