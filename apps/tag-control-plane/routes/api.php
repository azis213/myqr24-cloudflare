<?php

declare(strict_types=1);

use App\Http\Controllers\ApiAuthenticationController;
use App\Http\Controllers\RoutingAdministrationController;
use App\Http\Controllers\TagManagementController;
use App\Http\Middleware\AddNoStoreHeader;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

Route::middleware(['web'])->prefix('v1/auth')->group(function (): void {
    Route::get('/csrf', [ApiAuthenticationController::class, 'csrf']);
    Route::get('/session', [ApiAuthenticationController::class, 'status']);
    Route::post('/login', [ApiAuthenticationController::class, 'login'])->middleware('throttle:5,1');
    Route::post('/mfa/verify', [ApiAuthenticationController::class, 'verifyMfa'])->middleware('throttle:10,1');
    Route::post('/tag-management/reauthenticate', [ApiAuthenticationController::class, 'reauthenticateTagManagement'])
        ->middleware('throttle:5,1');
    Route::post('/logout', [ApiAuthenticationController::class, 'logout']);
});

Route::middleware(['web'])->prefix('v1/admin/tag-management')->group(function (): void {
    Route::get('/ranges', [TagManagementController::class, 'ranges']);
    Route::post('/ranges', [TagManagementController::class, 'createRange']);
    Route::patch('/ranges/{rangeId}', [TagManagementController::class, 'updateRange']);
    Route::get('/pools', [TagManagementController::class, 'pools']);
    Route::post('/pools', [TagManagementController::class, 'createPool']);
    Route::patch('/pools/{poolId}', [TagManagementController::class, 'updatePool']);
    Route::get('/pools/{poolId}/tags', [TagManagementController::class, 'tags']);
    Route::post('/pools/{poolId}/reservations', [TagManagementController::class, 'reserve']);
    Route::post('/tags/{tagId}/transitions', [TagManagementController::class, 'transition']);
});

Route::middleware(['web', AddNoStoreHeader::class])->prefix('v1/admin/routing')->group(function (): void {
    Route::get('/catalog', [RoutingAdministrationController::class, 'catalog']);
    Route::put('/features/{featureId}', [RoutingAdministrationController::class, 'saveFeature']);
    Route::put('/assignments/{scope}/{targetId}', [RoutingAdministrationController::class, 'assign']);
    Route::get('/projection/preview', [RoutingAdministrationController::class, 'preview']);
    Route::post('/projection/publish', [RoutingAdministrationController::class, 'publish']);
    Route::post('/projection/unpublish', [RoutingAdministrationController::class, 'unpublish']);
    Route::get('/outbox', [RoutingAdministrationController::class, 'outbox']);
    Route::post('/outbox/{eventId}/retry', [RoutingAdministrationController::class, 'retry']);
});

Route::prefix('v1')->group(function (): void {
    Route::get('/health', function (Request $request): array {
        return [
            'status' => 'ok',
            'service' => 'tag-control-plane',
            'correlation_id' => $request->attributes->get('correlation_id'),
        ];
    });

    Route::get('/ready', function (Request $request) {
        try {
            DB::connection()->select('SELECT 1');

            return response()->json([
                'status' => 'ready',
                'service' => 'tag-control-plane',
                'correlation_id' => $request->attributes->get('correlation_id'),
            ]);
        } catch (\Throwable) {
            return response()->json([
                'status' => 'not_ready',
                'service' => 'tag-control-plane',
                'correlation_id' => $request->attributes->get('correlation_id'),
            ], 503);
        }
    });
});
