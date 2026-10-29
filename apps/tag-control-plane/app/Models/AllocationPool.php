<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class AllocationPool extends Model
{
    use HasUuids;

    protected $fillable = [
        'pool_id',
        'organization_id',
        'display_name',
        'channel',
        'length',
        'policy_ref',
        'capacity_warning_threshold',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'length' => 'integer',
            'capacity_warning_threshold' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function ranges(): BelongsToMany
    {
        return $this->belongsToMany(TagRange::class, 'allocation_pool_ranges', 'pool_id', 'range_id')
            ->withTimestamps();
    }

    public function allocations(): HasMany
    {
        return $this->hasMany(TagAllocation::class, 'pool_id');
    }
}
