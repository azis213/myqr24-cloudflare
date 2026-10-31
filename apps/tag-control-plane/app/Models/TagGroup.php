<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class TagGroup extends Model
{
    use HasUuids;

    protected $fillable = ['group_id', 'feature_ids'];

    protected function casts(): array
    {
        return ['feature_ids' => 'array'];
    }
}
