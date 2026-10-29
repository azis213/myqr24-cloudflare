<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AllocationPool;
use App\Models\User;
use App\Services\TagAllocationService;
use App\Services\TagManagementAuthorizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class TagManagementController extends Controller
{
    public function pools(Request $request, TagManagementAuthorizer $authorizer): JsonResponse
    {
        $user = $this->user();

        $pools = AllocationPool::query()
            ->with('ranges')
            ->orderBy('pool_id')
            ->get()
            ->filter(fn (AllocationPool $pool): bool => $authorizer->canReadPool($user, $pool))
            ->map(static fn (AllocationPool $pool): array => [
                'poolId' => $pool->pool_id,
                'length' => $pool->length,
                'active' => $pool->is_active,
                'rangeIds' => $pool->ranges->pluck('range_id')->values(),
            ])
            ->values();

        return response()->json([
            'pools' => $pools,
            'correlation_id' => $request->attributes->get('correlation_id'),
        ]);
    }

    public function reserve(
        Request $request,
        string $poolId,
        TagManagementAuthorizer $authorizer,
        TagAllocationService $allocation,
    ): JsonResponse {
        $user = $this->user();
        $pool = AllocationPool::query()
            ->with('ranges')
            ->where('pool_id', $poolId)
            ->first();

        if ($pool === null) {
            return $this->forbidden($request);
        }

        try {
            $authorizer->requireReservation($request, $user, $pool);
        } catch (RuntimeException) {
            return $this->forbidden($request);
        }

        $validated = $request->validate([
            'quantity' => ['required', 'integer', 'min:1', 'max:1000'],
        ]);
        $idempotencyKey = $request->header('Idempotency-Key');

        if (! is_string($idempotencyKey) || ! preg_match('/^[0-9a-fA-F-]{36}$/', $idempotencyKey)) {
            throw ValidationException::withMessages([
                'request' => ['Für diese Verwaltungsaktion ist ein gültiger Idempotency-Key erforderlich.'],
            ]);
        }

        try {
            $result = $allocation->reserve(
                $request,
                $user,
                $pool,
                $validated['quantity'],
                strtolower($idempotencyKey),
            );
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() === 'Idempotency request mismatch.') {
                return response()->json($this->errorPayload($request), 409);
            }

            if ($exception->getMessage() === 'Codec unavailable.') {
                return response()->json($this->errorPayload($request), 503);
            }

            throw ValidationException::withMessages([
                'request' => ['Die angeforderte Verwaltungsaktion ist nicht zulässig.'],
            ]);
        }

        return response()->json([
            ...$result,
            'audit_reference' => $result['job_id'],
            'correlation_id' => $request->attributes->get('correlation_id'),
        ], 201);
    }

    private function user(): User
    {
        $user = Auth::guard('web')->user();

        if (! $user instanceof User) {
            abort(401);
        }

        return $user;
    }

    private function forbidden(Request $request): JsonResponse
    {
        return response()->json($this->errorPayload($request), 403);
    }

    private function errorPayload(Request $request): array
    {
        return [
            'message' => 'The given data was invalid.',
            'errors' => [
                'request' => ['Die angeforderte Verwaltungsaktion ist nicht zulässig.'],
            ],
            'correlation_id' => $request->attributes->get('correlation_id'),
        ];
    }
}
