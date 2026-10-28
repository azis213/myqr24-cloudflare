<?php

declare(strict_types=1);

return [
    /*
    |--------------------------------------------------------------------------
    | Administration bootstrap
    |--------------------------------------------------------------------------
    |
    | These values are read only by the explicit CLI bootstrap command.
    | They must be supplied through the deployment environment and must never
    | be exposed through an HTTP endpoint or the Control Center.
    |
    */

    'bootstrap_admin' => [
        'email' => env('TCP_BOOTSTRAP_ADMIN_EMAIL', 'azis213@gmail.com'),
        'initial_password' => env('TCP_BOOTSTRAP_ADMIN_INITIAL_PASSWORD'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Email MFA policy
    |--------------------------------------------------------------------------
    |
    | Email MFA is a transitional, server-enforced second factor. The policy
    | is deliberately environment configuration, not a browser preference.
    |
    */

    'email_mfa' => [
        'enabled' => env('TCP_EMAIL_MFA_ENABLED', true),
        'code_ttl_seconds' => (int) env('TCP_EMAIL_MFA_CODE_TTL_SECONDS', 600),
        'max_attempts' => (int) env('TCP_EMAIL_MFA_MAX_ATTEMPTS', 5),
        'resend_cooldown_seconds' => (int) env('TCP_EMAIL_MFA_RESEND_COOLDOWN_SECONDS', 60),
    ],
];
