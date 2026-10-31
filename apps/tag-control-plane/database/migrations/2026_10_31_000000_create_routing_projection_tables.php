<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tag_groups', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('group_id', 128)->unique();
            $table->json('feature_ids');
            $table->timestamps(6);
        });

        Schema::create('feature_definitions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('feature_id', 128)->unique();
            $table->json('definition');
            $table->timestamps(6);
        });

        Schema::create('routing_feature_assignments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('scope', 16);
            $table->uuid('range_id')->nullable();
            $table->uuid('tag_allocation_id')->nullable();
            $table->json('feature_ids');
            $table->timestamps(6);

            $table->foreign('range_id')->references('id')->on('tag_ranges')->cascadeOnDelete();
            $table->foreign('tag_allocation_id')->references('id')->on('tag_allocations')->cascadeOnDelete();
            $table->unique(['scope', 'range_id'], 'routing_assignments_scope_range_unique');
            $table->unique(['scope', 'tag_allocation_id'], 'routing_assignments_scope_tag_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('routing_feature_assignments');
        Schema::dropIfExists('feature_definitions');
        Schema::dropIfExists('tag_groups');
    }
};
