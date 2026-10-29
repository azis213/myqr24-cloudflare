<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('organizations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('display_name', 191);
            $table->boolean('is_active')->default(true);
            $table->timestamps(6);
        });

        Schema::create('organization_user_roles', function (Blueprint $table): void {
            $table->uuid('organization_id');
            $table->uuid('user_id');
            $table->string('role', 64);
            $table->timestamps(6);

            $table->primary(['organization_id', 'user_id', 'role']);
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->index(['user_id', 'role'], 'organization_user_roles_user_role_idx');
        });

        Schema::create('tag_ranges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('range_id', 128)->unique();
            $table->string('group_id', 128);
            $table->unsignedTinyInteger('length');
            $table->string('start_value', 32);
            $table->string('end_value', 32);
            $table->boolean('is_active')->default(true);
            $table->timestamps(6);

            $table->index(['length', 'is_active'], 'tag_ranges_length_active_idx');
        });

        Schema::create('allocation_pools', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('pool_id', 128)->unique();
            $table->uuid('organization_id')->nullable();
            $table->string('display_name', 191);
            $table->string('channel', 64);
            $table->unsignedTinyInteger('length');
            $table->string('policy_ref', 191);
            $table->unsignedInteger('capacity_warning_threshold')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps(6);

            $table->foreign('organization_id')->references('id')->on('organizations')->nullOnDelete();
            $table->index(['organization_id', 'is_active'], 'allocation_pools_organization_active_idx');
        });

        Schema::create('allocation_pool_ranges', function (Blueprint $table): void {
            $table->uuid('pool_id');
            $table->uuid('range_id');
            $table->timestamps(6);

            $table->primary(['pool_id', 'range_id']);
            $table->foreign('pool_id')->references('id')->on('allocation_pools')->cascadeOnDelete();
            $table->foreign('range_id')->references('id')->on('tag_ranges')->restrictOnDelete();
        });

        Schema::create('idempotency_records', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('actor_id');
            $table->string('command', 128);
            $table->uuid('idempotency_key');
            $table->string('request_hash', 64);
            $table->string('status', 32);
            $table->json('response_payload')->nullable();
            $table->uuid('allocation_job_id')->nullable();
            $table->timestamps(6);

            $table->unique(['actor_id', 'command', 'idempotency_key'], 'idempotency_records_actor_command_key_unique');
        });

        Schema::create('allocation_jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('pool_id');
            $table->uuid('actor_id');
            $table->uuid('organization_id')->nullable();
            $table->unsignedInteger('quantity');
            $table->string('status', 32);
            $table->json('reserved_values');
            $table->timestamps(6);

            $table->foreign('pool_id')->references('id')->on('allocation_pools')->restrictOnDelete();
            $table->foreign('actor_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('organization_id')->references('id')->on('organizations')->nullOnDelete();
            $table->index(['pool_id', 'status'], 'allocation_jobs_pool_status_idx');
        });

        Schema::create('tag_allocations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('pool_id');
            $table->uuid('range_id');
            $table->uuid('organization_id')->nullable();
            $table->unsignedTinyInteger('length');
            $table->string('decoded_value', 32);
            $table->string('tag_id', 10)->nullable();
            $table->string('codec_version', 64)->nullable();
            $table->string('status', 64)->default('codec-pending');
            $table->uuid('allocation_job_id');
            $table->timestamps(6);

            $table->foreign('pool_id')->references('id')->on('allocation_pools')->restrictOnDelete();
            $table->foreign('range_id')->references('id')->on('tag_ranges')->restrictOnDelete();
            $table->foreign('organization_id')->references('id')->on('organizations')->nullOnDelete();
            $table->foreign('allocation_job_id')->references('id')->on('allocation_jobs')->restrictOnDelete();
            $table->unique(['length', 'decoded_value'], 'tag_allocations_length_decoded_value_unique');
            $table->unique('tag_id', 'tag_allocations_tag_id_unique');
            $table->index(['pool_id', 'status'], 'tag_allocations_pool_status_idx');
            $table->index('allocation_job_id', 'tag_allocations_job_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tag_allocations');
        Schema::dropIfExists('allocation_jobs');
        Schema::dropIfExists('idempotency_records');
        Schema::dropIfExists('allocation_pool_ranges');
        Schema::dropIfExists('allocation_pools');
        Schema::dropIfExists('tag_ranges');
        Schema::dropIfExists('organization_user_roles');
        Schema::dropIfExists('organizations');
    }
};
