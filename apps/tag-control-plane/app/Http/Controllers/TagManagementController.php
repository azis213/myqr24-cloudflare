<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\AllocationPool;
use App\Models\IdempotencyRecord;
use App\Models\TagRange;
use App\Models\User;
use App\Services\AllocationPoolService;
use App\Services\TagAllocationService;
use App\Services\TagManagementAuthorizer;
use App\Services\TagRangeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class TagManagementController extends Controller
{
    public function ranges(Request $request, TagManagementAuthorizer $authorizer): JsonResponse
    {
        $user = $this->user();

        if (! $authorizer->canReadRanges($user)) {
            return $this->forbidden($request);
        }

        return response()->json([
            'ranges' => TagRange::query()
                ->orderBy('length')
                ->orderBy('start_value')
                ->get()
                ->map(static fn (TagRange $range): array => [
                    'rangeId' => $range->range_id,
                    'groupId' => $range->group_id,
                    'length' => $range->length,
                    'startValue' => $range->start_value,
                    'endValue' => $range->end_value,
                    'active' => $range->is_active,
                ])
                ->values(),
            'correlation_id' => $request->attributes->get('correlation_id'),
        ]);
    }

    public function createRange(
        Request $request,
        TagManagementAuthorizer $authorizer,
        TagRangeService $ranges,
    ): JsonResponse {
        $user = $this->user();

        try {
            $authorizer->requireRangeMutation($request, $user);
        } catch (RuntimeException) {
            return $this->forbidden($request);
        }

        $input = $request->validate([
            'rangeId' => ['required', 'string', 'max:128'],
            'groupId' => ['required', 'string', 'max:128'],
            'length' => ['required', 'integer'],
            'startValue' => ['required', 'string', 'max:32'],
            'endValue' => ['required', 'string', 'max:32'],
            'active' => ['required', 'boolean'],
        ]);
        $idempotencyKey = $this->idempotencyKey($request);

        try {
            $response = DB::transaction(function () use ($ranges, $input, $idempotencyKey, $user): array {
                $existing = $this->existingIdempotencyResponse($user, 'range.create', $idempotencyKey, $input);

                if ($existing !== null) {
                    return $existing;
                }

                $range = $ranges->create($input);
                $response = [
                    'range' => [
                        'rangeId' => $range->range_id,
                        'groupId' => $range->group_id,
                        'length' => $range->length,
                        'startValue' => $range->start_value,
                        'endValue' => $range->end_value,
                        'active' => $range->is_active,
                    ],
                ];
                $this->storeIdempotencyResponse($user, 'range.create', $idempotencyKey, $input, $response);

                return $response;
            });
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() === 'Idempotency request mismatch.') {
                return response()->json($this->errorPayload($request), 409);
            }

            throw ValidationException::withMessages([
                'request' => ['Die angeforderte Verwaltungsaktion ist nicht zulässig.'],
            ]);
        }

        return response()->json([
            ...$response,
            'correlation_id' => $request->attributes->get('correlation_id'),
        ], 201);
    }

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

    public function createPool(
        Request $request,
        TagManagementAuthorizer $authorizer,
        AllocationPoolService $pools,
    ): JsonResponse {
        $user = $this->user();
        $input = $request->validate([
            'poolId' => ['required', 'string', 'max:128'],
            'organizationId' => ['nullable', 'uuid'],
            'displayName' => ['required', 'string', 'max:191'],
            'channel' => ['required', 'string', 'max:64'],
            'length' => ['required', 'integer'],
            'rangeIds' => ['required', 'array', 'min:1'],
            'rangeIds.*' => ['string', 'max:128'],
            'policyRef' => ['required', 'string', 'max:191'],
            'capacityWarningThreshold' => ['required', 'integer', 'min:0'],
            'active' => ['required', 'boolean'],
        ]);

        try {
            $authorizer->requirePoolMutation($request, $user, $input['organizationId']);
        } catch (RuntimeException) {
            return $this->forbidden($request);
        }

        $idempotencyKey = $this->idempotencyKey($request);

        try {
            $response = DB::transaction(function () use ($pools, $input, $idempotencyKey, $user): array {
                $existing = $this->existingIdempotencyResponse($user, 'pool.create', $idempotencyKey, $input);

                if ($existing !== null) {
                    return $existing;
                }

                $pool = $pools->create($input);
                $response = [
                    'pool' => [
                        'poolId' => $pool->pool_id,
                        'length' => $pool->length,
                        'active' => $pool->is_active,
                        'rangeIds' => $pool->ranges->pluck('range_id')->values()->all(),
                    ],
                ];
                $this->storeIdempotencyResponse($user, 'pool.create', $idempotencyKey, $input, $response);

                return $response;
            });
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() === 'Idempotency request mismatch.') {
                return response()->json($this->errorPayload($request), 409);
            }

            throw ValidationException::withMessages([
                'request' => ['Die angeforderte Verwaltungsaktion ist nicht zulässig.'],
            ]);
        }

        return response()->json([
            ...$response,
            'correlation_id' => $request->attributes->get('correlation_id'),
        ], 201);
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

    private function idempotencyKey(Request $request): string
    {
        $key = $request->header('Idempotency-Key');

        if (! is_string($key) || ! preg_match('/^[0-9a-fA-F-]{36}$/', $key)) {
            throw ValidationException::withMessages([
                'request' => ['Für diese Verwaltungsaktion ist ein gültiger Idempotency-Key erforderlich.'],
            ]);
        }

        return strtolower($key);
    }

    private function existingIdempotencyResponse(
        User $user,
        string $command,
        string $idempotencyKey,
        array $input,
    ): ?array {
        $record = IdempotencyRecord::query()
            ->lockForUpdate()
            ->where('actor_id', $user->id)
            ->where('command', $command)
            ->where('idempotency_key', $idempotencyKey)
            ->first();

        if ($record === null) {
            return null;
        }

        if ($record->request_hash !== $this->requestHash($input)) {
            throw new RuntimeException('Idempotency request mismatch.');
        }

        return $record->response_payload ?? [];
    }

    private function storeIdempotencyResponse(
        User $user,
        string $command,
        string $idempotencyKey,
        array $input,
        array $response,
    ): void {
        IdempotencyRecord::query()->create([
            'actor_id' => $user->id,
            'command' => $command,
            'idempotency_key' => $idempotencyKey,
            'request_hash' => $this->requestHash($input),
            'status' => 'completed',
            'response_payload' => $response,
        ]);
    }

    private function requestHash(array $input): string
    {
        ksort($input);

        return hash('sha256', json_encode($input, JSON_THROW_ON_ERROR));
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
