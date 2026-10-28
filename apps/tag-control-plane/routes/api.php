<?php

declare(strict_types=1);

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;

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
