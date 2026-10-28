<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_events', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('correlation_id');
            $table->string('actor_type', 64);
            $table->string('actor_id', 191);
            $table->string('object_type', 64);
            $table->string('object_id', 191);
            $table->string('action', 128);
            $table->json('metadata');
            $table->timestamp('occurred_at', 6)->useCurrent();

            $table->index('correlation_id', 'audit_events_correlation_id_idx');
            $table->index(['object_type', 'object_id', 'occurred_at'], 'audit_events_object_idx');
            $table->index(['actor_type', 'actor_id', 'occurred_at'], 'audit_events_actor_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_events');
    }
};
