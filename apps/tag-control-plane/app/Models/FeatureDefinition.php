<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

final class FeatureDefinition extends Model
{
    use HasUuids;

    protected $fillable = ['feature_id', 'definition'];

    protected function casts(): array
    {
        return ['definition' => 'array'];
    }
}
