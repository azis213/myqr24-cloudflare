<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\TagAllocation;
use RuntimeException;

final class TagLifecycleService
{
    /** @return array{allocation: TagAllocation, previousStatus: string} */
    public function transition(TagAllocation $allocation, string $targetStatus, string $reason): array
    {
        if (trim($reason) === '' || mb_strlen($reason) > 191) {
            throw new RuntimeException('Invalid lifecycle reason.');
        }

        $allowedTransitions = [
            'draft' => 'pending-review',
            'pending-review' => 'ready-to-publish',
        ];

        if (($allowedTransitions[$allocation->status] ?? null) !== $targetStatus) {
            throw new RuntimeException('Invalid lifecycle transition.');
        }

        $previousStatus = $allocation->status;
        $allocation->update(['status' => $targetStatus]);

        return ['allocation' => $allocation->refresh(), 'previousStatus' => $previousStatus];
    }
}