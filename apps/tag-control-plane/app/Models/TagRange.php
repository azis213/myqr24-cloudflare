<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class TagRange extends Model
{
    use HasUuids;

    protected $fillable = [
        'range_id',
        'group_id',
        'length',
        'start_value',
        'end_value',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'length' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function pools(): BelongsToMany
    {
        return $this->belongsToMany(AllocationPool::class, 'allocation_pool_ranges', 'range_id', 'pool_id')
            ->withTimestamps();
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(TagAllocation::class, 'range_id');
    }
}
