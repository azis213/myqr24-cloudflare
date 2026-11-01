<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\RoutingAdministrationService;
use App\Services\RoutingCommandService;
use App\Services\RoutingPublishingService;
use App\Services\TagManagementAuthorizer;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use RuntimeException;

final class RoutingAdministrationController extends Controller
{
    public function __construct(private readonly RoutingCommandService $commands)
    {
    }

    public function catalog(Request $request, TagManagementAuthorizer $auth, RoutingAdministrationService $admin, RoutingPublishingService $publishing): JsonResponse
    {
        if (! $auth->canReadRouting($this->user())) {
            return $this->forbidden($request);
        }
        return response()->json([...$admin->catalog(), 'outbox' => $publishing->outbox(), 'correlation_id' => $this->correlation($request)]);
    }

    public function saveFeature(Request $request, string $featureId, TagManagementAuthorizer $auth, RoutingAdministrationService $admin): JsonResponse
    {
        if (! $this->authorizeMutation($request, $auth)) {
            return $this->forbidden($request);
        }
        $input = $request->validate(['definition' => ['required', 'array']]);
        $response = $this->command($request, 'routing.feature.save', [...$input, 'featureId' => $featureId], fn (): array => $admin->saveFeature($this->user(), $featureId, $input['definition'], $this->correlation($request)));
        return response()->json([...$response, 'correlation_id' => $this->correlation($request)]);
    }

    public function assign(Request $request, string $scope, string $targetId, TagManagementAuthorizer $auth, RoutingAdministrationService $admin): JsonResponse
    {
        if (! $this->authorizeMutation($request, $auth)) {
            return $this->forbidden($request);
        }
        $input = $request->validate(['featureIds' => ['required', 'array', 'max:32'], 'featureIds.*' => ['string', 'max:128']]);
        $input = [...$input, 'scope' => $scope, 'targetId' => $targetId];
        $response = $this->command($request, 'routing.assignment.save', $input, fn (): array => $admin->assign($this->user(), $scope, $targetId, $input['featureIds'], $this->correlation($request)));
        return response()->json([...$response, 'correlation_id' => $this->correlation($request)]);
    }

    public function preview(Request $request, TagManagementAuthorizer $auth, RoutingPublishingService $publishing): JsonResponse
    {
        if (! $auth->canReadRouting($this->user())) {
            return $this->forbidden($request);
        }
        try {
            return response()->json([...$publishing->preview(), 'correlation_id' => $this->correlation($request)]);
        } catch (InvalidArgumentException) {
            throw $this->invalid();
        }
    }

    public function publish(Request $request, TagManagementAuthorizer $auth, RoutingPublishingService $publishing): JsonResponse
    {
        return $this->publishOperation('publish', $request, $auth, $publishing);
    }

    public function unpublish(Request $request, TagManagementAuthorizer $auth, RoutingPublishingService $publishing): JsonResponse
    {
        return $this->publishOperation('unpublish', $request, $auth, $publishing);
    }

    public function retry(Request $request, string $eventId, TagManagementAuthorizer $auth, RoutingPublishingService $publishing): JsonResponse
    {
        if (! $this->authorizeMutation($request, $auth)) {
            return $this->forbidden($request);
        }
        $response = $this->command($request, 'routing.outbox.retry', ['eventId' => $eventId], fn (): array => $publishing->prepareRetry($eventId, $this->user(), $this->correlation($request)));
        return $this->processResponse($response, $request, $publishing);
    }

    public function outbox(Request $request, TagManagementAuthorizer $auth, RoutingPublishingService $publishing): JsonResponse
    {
        if (! $auth->canReadRouting($this->user())) {
            return $this->forbidden($request);
        }
        return response()->json(['events' => $publishing->outbox(), 'correlation_id' => $this->correlation($request)]);
    }

    private function publishOperation(string $operation, Request $request, TagManagementAuthorizer $auth, RoutingPublishingService $publishing): JsonResponse
    {
        if (! $this->authorizeMutation($request, $auth)) {
            return $this->forbidden($request);
        }
        $response = $this->command($request, 'routing.'.$operation, ['operation' => $operation], fn (): array => $publishing->create($operation, $this->user(), $this->correlation($request)));
        return $this->processResponse($response, $request, $publishing);
    }

    private function processResponse(array $response, Request $request, RoutingPublishingService $publishing): JsonResponse
    {
        $result = $publishing->process($response['eventId']);
        return response()->json([...$result, 'correlation_id' => $this->correlation($request)], $result['status'] === 'completed' ? 200 : 202);
    }

    private function command(Request $request, string $command, array $input, callable $mutation): array
    {
        $key = $request->header('Idempotency-Key');
        try {
            return $this->commands->execute($this->user(), is_string($key) ? $key : '', $command, $input, $mutation);
        } catch (InvalidArgumentException) {
            throw $this->invalid();
        } catch (RuntimeException $exception) {
            if ($exception->getMessage() === 'Idempotency request mismatch.') {
                throw new HttpResponseException(response()->json($this->errorPayload($request), 409));
            }
            throw $exception;
        }
    }

    private function authorizeMutation(Request $request, TagManagementAuthorizer $auth): bool
    {
        try {
            $auth->requireRoutingMutation($request, $this->user());
            return true;
        } catch (RuntimeException) {
            return false;
        }
    }

    private function user(): User
    {
        $user = Auth::guard('web')->user();
        if (! $user instanceof User) {
            abort(401);
        }
        return $user;
    }

    private function correlation(Request $request): string
    {
        $correlation = $request->attributes->get('correlation_id');
        if (! is_string($correlation)) {
            abort(500);
        }
        return $correlation;
    }

    private function invalid(): ValidationException
    {
        return ValidationException::withMessages(['request' => ['Die angeforderte Verwaltungsaktion ist nicht zulässig.']]);
    }

    private function forbidden(Request $request): JsonResponse
    {
        return response()->json($this->errorPayload($request), 403);
    }

    private function errorPayload(Request $request): array
    {
        return ['message' => 'The given data was invalid.', 'errors' => ['request' => ['Die angeforderte Verwaltungsaktion ist nicht zulässig.']], 'correlation_id' => $this->correlation($request)];
    }
}
