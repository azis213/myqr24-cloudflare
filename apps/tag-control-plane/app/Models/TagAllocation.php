<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

final class TagAllocation extends Model
{
    use HasUuids;

    protected $fillable = [
        'pool_id',
        'range_id',
        'organization_id',
        'length',
        'decoded_value',
        'tag_id',
        'codec_version',
        'status',
        'allocation_job_id',
    ];

    protected function casts(): array
    {
        return [
            'length' => 'integer',
        ];
    }

    public function pool(): BelongsTo
    {
        return $this->belongsTo(AllocationPool::class, 'pool_id');
    }

    public function range(): BelongsTo
    {
        return $this->belongsTo(TagRange::class, 'range_id');
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
