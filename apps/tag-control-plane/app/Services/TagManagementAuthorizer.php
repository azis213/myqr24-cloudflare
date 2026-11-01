<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AllocationPool;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use RuntimeException;

final class TagManagementAuthorizer
{
    public const PLATFORM_ADMIN = 'platform-admin';
    public const ORGANIZATION_ADMIN = 'organization-admin';
    public const ALLOCATION_OPERATOR = 'allocation-operator';

    public function __construct(
        private readonly AuthenticationService $authentication,
        private readonly AuditService $auditService,
    ) {
    }

    public function canReadRanges(User $user): bool
    {
        return $user->role === self::PLATFORM_ADMIN;
    }

    public function canReadRouting(User $user): bool
    {
        return $user->role === self::PLATFORM_ADMIN;
    }

    public function requireRoutingMutation(Request $request, User $user): void
    {
        $this->requirePlatformAdmin($request, $user, 'routing.mutate');
        $this->requireRecentReauthentication($request, $user, 'routing.mutate');
    }

    public function requireRangeMutation(Request $request, User $user): void
    {
        $this->requirePlatformAdmin($request, $user, 'range.mutate');
        $this->requireRecentReauthentication($request, $user, 'range.mutate');
    }

    public function requirePoolMutation(Request $request, User $user, ?string $organizationId): void
    {
        if ($user->role === self::PLATFORM_ADMIN) {
            $this->requireRecentReauthentication($request, $user, 'pool.mutate');

            return;
        }

        if (
            $organizationId === null
            || ! $this->hasOrganizationRole($user, $organizationId, self::ORGANIZATION_ADMIN)
        ) {
            $this->deny($request, $user, 'pool.mutate');
        }

        $this->requireRecentReauthentication($request, $user, 'pool.mutate');
    }

    public function requireReservation(Request $request, User $user, AllocationPool $pool): void
    {
        if ($user->role !== self::PLATFORM_ADMIN) {
            $organizationId = $pool->organization_id;

            if (
                $organizationId === null
                || ! $this->hasOrganizationRole(
                    $user,
                    $organizationId,
                    self::ORGANIZATION_ADMIN,
                    self::ALLOCATION_OPERATOR,
                )
            ) {
                $this->deny($request, $user, 'allocation.reserve');
            }
        }

        $this->requireRecentReauthentication($request, $user, 'allocation.reserve');
    }

    public function canReadPool(User $user, AllocationPool $pool): bool
    {
        if ($user->role === self::PLATFORM_ADMIN) {
            return true;
        }

        return $pool->organization_id !== null
            && $this->hasOrganizationRole(
                $user,
                $pool->organization_id,
                self::ORGANIZATION_ADMIN,
                self::ALLOCATION_OPERATOR,
            );
    }

    public function requireLifecycleTransition(
        Request $request,
        User $user,
        AllocationPool $pool,
        string $targetStatus,
    ): void {
        $isDraftSubmission = $targetStatus === 'pending-review';

        if (! $this->canReadPool($user, $pool)) {
            $this->deny($request, $user, 'tag.transition');
        }

        if ($user->role === self::PLATFORM_ADMIN) {
            if (! $isDraftSubmission) {
                $this->requireRecentReauthentication($request, $user, 'tag.transition');
            }

            return;
        }

        $organizationId = $pool->organization_id;
        $isOrganizationAdmin = $organizationId !== null
            && $this->hasOrganizationRole($user, $organizationId, self::ORGANIZATION_ADMIN);
        $isOperator = $organizationId !== null
            && $this->hasOrganizationRole($user, $organizationId, self::ALLOCATION_OPERATOR);

        if ($isOperator && $isDraftSubmission) {
            return;
        }

        if (! $isOrganizationAdmin || $targetStatus === 'active') {
            $this->deny($request, $user, 'tag.transition');
        }

        $this->requireRecentReauthentication($request, $user, 'tag.transition');
    }

    private function requirePlatformAdmin(Request $request, User $user, string $command): void
    {
        if ($user->role !== self::PLATFORM_ADMIN) {
            $this->deny($request, $user, $command);
        }
    }

    private function requireRecentReauthentication(Request $request, User $user, string $command): void
    {
        if (! $this->authentication->hasRecentTagManagementReauthentication($request)) {
            $this->deny($request, $user, $command);
        }
    }

    private function hasOrganizationRole(User $user, string $organizationId, string ...$allowedRoles): bool
    {
        return DB::table('organization_user_roles')
            ->where('organization_id', $organizationId)
            ->where('user_id', $user->id)
            ->whereIn('role', $allowedRoles)
            ->exists();
    }

    private function deny(Request $request, User $user, string $command): never
    {
        $this->auditService->record(
            correlationId: $this->correlationId($request),
            actorType: 'user',
            actorId: $user->id,
            objectType: 'tag_management',
            objectId: $command,
            action: 'tag_management.authorization.denied',
        );

        throw new RuntimeException('Tag-management authorization denied.');
    }

    private function correlationId(Request $request): string
    {
        $correlationId = $request->attributes->get('correlation_id');

        if (! is_string($correlationId)) {
            throw new RuntimeException('Missing request correlation ID.');
        }

        return $correlationId;
    }
}
