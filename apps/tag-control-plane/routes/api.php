<?php

declare(strict_types=1);

use App\Http\Controllers\ApiAuthenticationController;
use App\Http\Controllers\TagManagementController;
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
    Route::get('/pools', [TagManagementController::class, 'pools']);
    Route::post('/pools', [TagManagementController::class, 'createPool']);
    Route::post('/pools/{poolId}/reservations', [TagManagementController::class, 'reserve']);
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
