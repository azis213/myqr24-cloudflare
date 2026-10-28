<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('email', 191)->unique();
            $table->string('password');
            $table->string('role', 64);
            $table->boolean('is_active')->default(true);
            $table->timestamps(6);

            $table->index(['role', 'is_active'], 'users_role_active_idx');
        });

        Schema::create('email_mfa_challenges', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->string('code_hash');
            $table->unsignedTinyInteger('attempt_count')->default(0);
            $table->timestamp('expires_at', 6);
            $table->timestamp('consumed_at', 6)->nullable();
            $table->timestamps(6);

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->cascadeOnDelete();

            $table->index(['user_id', 'expires_at'], 'email_mfa_challenges_user_expiry_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_mfa_challenges');
        Schema::dropIfExists('users');
    }
};
