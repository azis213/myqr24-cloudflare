<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

final class Organization extends Model
{
    use HasUuids;

    protected $fillable = [
        'display_name',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'organization_user_roles')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function pools(): HasMany
    {
        return $this->hasMany(AllocationPool::class);
    }
}
