<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('routing_feature_assignments', function (Blueprint $table): void {
            $table->uuid('pool_id')->nullable()->after('range_id');
            $table->foreign('pool_id')->references('id')->on('allocation_pools')->cascadeOnDelete();
            $table->unique(['scope', 'pool_id'], 'routing_assignments_scope_pool_unique');
        });

        Schema::create('routing_projection_revisions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('environment', 32);
            $table->string('operation', 16);
            $table->json('documents');
            $table->json('diff');
            $table->string('status', 32);
            $table->uuid('correlation_id');
            $table->timestamps(6);
            $table->index(['environment', 'status'], 'routing_revisions_environment_status_idx');
        });

        Schema::create('routing_outbox_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->unsignedBigInteger('projection_revision_id');
            $table->string('environment', 32);
            $table->string('operation', 16);
            $table->json('documents');
            $table->json('previous_documents');
            $table->json('diff');
            $table->string('status', 32);
            $table->unsignedInteger('attempt_count')->default(0);
            $table->string('last_error_class', 32)->nullable();
            $table->uuid('correlation_id');
            $table->timestamp('available_at', 6)->nullable();
            $table->timestamp('published_at', 6)->nullable();
            $table->timestamps(6);
            $table->foreign('projection_revision_id')->references('id')->on('routing_projection_revisions')->restrictOnDelete();
            $table->unique(['environment', 'projection_revision_id', 'operation'], 'routing_outbox_revision_operation_unique');
            $table->index(['status', 'available_at'], 'routing_outbox_status_available_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('routing_outbox_events');
        Schema::dropIfExists('routing_projection_revisions');
        Schema::table('routing_feature_assignments', function (Blueprint $table): void {
            $table->dropUnique('routing_assignments_scope_pool_unique');
            $table->dropForeign(['pool_id']);
            $table->dropColumn('pool_id');
        });
    }
};
