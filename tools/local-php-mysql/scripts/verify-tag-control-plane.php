<?php

declare(strict_types=1);

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

const APP_PATH = '/workspace/tag-control-plane';

require APP_PATH.'/vendor/autoload.php';

$app = require APP_PATH.'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();

function fail(string $message): never
{
    fwrite(STDERR, "TAG control plane verification failed: {$message}\n");
    exit(1);
}

if ((string) config('database.default') !== 'mysql') {
    fail('Laravel default database connection is not mysql.');
}

try {
    Artisan::call('migrate', ['--force' => true]);

    $connection = DB::connection();
    $charset = (string) $connection->selectOne('SELECT @@character_set_connection AS value')->value;
    $timeZone = (string) $connection->selectOne('SELECT @@session.time_zone AS value')->value;

    if ($charset !== 'utf8mb4') {
        fail("expected utf8mb4 connection charset, got {$charset}.");
    }

    if ($timeZone !== '+00:00') {
        fail("expected UTC MySQL session timezone +00:00, got {$timeZone}.");
    }

    if (! Schema::hasTable('audit_events')) {
        fail('audit_events table was not created by the Laravel migration.');
    }

    $columns = Schema::getColumnListing('audit_events');

    foreach ([
        'id',
        'correlation_id',
        'actor_type',
        'actor_id',
        'object_type',
        'object_id',
        'action',
        'metadata',
        'occurred_at',
    ] as $requiredColumn) {
        if (! in_array($requiredColumn, $columns, true)) {
            fail("audit_events is missing required column {$requiredColumn}.");
        }
    }

    fwrite(STDOUT, "TAG control plane Laravel/MySQL verification passed.\n");
} catch (Throwable $exception) {
    fail($exception->getMessage());
} finally {
    Artisan::call('migrate:rollback', ['--force' => true]);
}
