<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Services\AuthenticationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use RuntimeException;

final class ApiAuthenticationController extends Controller
{
    public function csrf(Request $request): JsonResponse
    {
        return response()->json([
            'csrf_token' => $request->session()->token(),
            'correlation_id' => $request->attributes->get('correlation_id'),
        ]);
    }

    public function status(Request $request): JsonResponse
    {
        $user = Auth::guard('web')->user();

        return response()->json([
            'authenticated' => $user !== null,
            'user' => $user === null ? null : [
                'email' => $user->email,
                'role' => $user->role,
            ],
            'correlation_id' => $request->attributes->get('correlation_id'),
        ]);
    }

    public function login(Request $request, AuthenticationService $authentication): JsonResponse
    {
        $validated = $request->validate([
            'email' => ['required', 'email:rfc,dns', 'max:191'],
            'password' => ['required', 'string', 'max:1024'],
        ]);

        try {
            $result = $authentication->beginLogin(
                $request,
                $validated['email'],
                $validated['password'],
            );
        } catch (RuntimeException) {
            throw ValidationException::withMessages([
                'email' => ['Die Anmeldedaten sind ungültig oder das Konto ist nicht aktiv.'],
            ]);
        }

        return response()->json([
            ...$result,
            'correlation_id' => $request->attributes->get('correlation_id'),
        ]);
    }

    public function verifyMfa(Request $request, AuthenticationService $authentication): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'digits:6'],
        ]);

        try {
            $authentication->verifyEmailMfa($request, $validated['code']);
        } catch (RuntimeException) {
            throw ValidationException::withMessages([
                'code' => ['Der Sicherheitscode ist ungültig, abgelaufen oder wurde zu oft eingegeben.'],
            ]);
        }

        $user = Auth::guard('web')->user();

        return response()->json([
            'status' => 'authenticated',
            'user' => [
                'email' => $user?->email,
                'role' => $user?->role,
            ],
            'correlation_id' => $request->attributes->get('correlation_id'),
        ]);
    }

    public function logout(Request $request, AuthenticationService $authentication): JsonResponse
    {
        $authentication->logout($request);

        return response()->json([
            'status' => 'logged_out',
            'correlation_id' => $request->attributes->get('correlation_id'),
        ]);
    }
}
