<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Notifications\Notifiable;

final class User extends Authenticatable
{
    use HasUuids;
    use Notifiable;

    protected $fillable = [
        'email',
        'password',
        'role',
        'is_active',
    ];

    protected $hidden = [
        'password',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'password' => 'hashed',
        ];
    }

    public function emailMfaChallenges(): HasMany
    {
        return $this->hasMany(EmailMfaChallenge::class);
    }
}
