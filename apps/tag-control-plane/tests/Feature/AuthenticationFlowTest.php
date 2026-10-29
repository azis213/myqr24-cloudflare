<?php

declare(strict_types=1);

namespace Tests\Feature;

use App\Models\EmailMfaChallenge;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

final class AuthenticationFlowTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        config()->set('security.email_mfa.code_ttl_seconds', 600);
        config()->set('security.email_mfa.max_attempts', 5);
        Mail::fake();
    }

    public function test_password_login_creates_an_authenticated_session_when_email_mfa_is_disabled(): void
    {
        config()->set('security.email_mfa.enabled', false);

        $user = $this->createPlatformAdmin();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'correct-password',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('status', 'authenticated')
            ->assertJsonPath('correlation_id', fn (string $value): bool => $value !== '');

        $this->assertAuthenticatedAs($user);
        $this->assertDatabaseHas('audit_events', [
            'actor_id' => $user->id,
            'action' => 'authentication.login.password_only',
        ]);
    }

    public function test_login_normalizes_invalid_and_unknown_email_failures(): void
    {
        config()->set('security.email_mfa.enabled', false);

        foreach ([
            ['email' => 'not-an-email', 'password' => 'any-password'],
            ['email' => 'unknown@example.test', 'password' => 'any-password'],
        ] as $credentials) {
            $this->postJson('/api/v1/auth/login', $credentials)
                ->assertUnprocessable()
                ->assertJsonPath(
                    'errors.email.0',
                    'Die Anmeldedaten sind ungültig oder das Konto ist nicht aktiv.',
                );
        }

        $this->assertGuest();
    }

    public function test_email_mfa_challenge_is_hashed_and_requires_verification_before_authentication(): void
    {
        config()->set('security.email_mfa.enabled', true);

        $user = $this->createPlatformAdmin();

        $response = $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'correct-password',
        ]);

        $response
            ->assertOk()
            ->assertJsonPath('status', 'mfa_required');

        $this->assertGuest();

        $challenge = EmailMfaChallenge::query()->sole();
        self::assertSame($user->id, $challenge->user_id);
        self::assertNotSame('123456', $challenge->code_hash);
        self::assertTrue(Hash::check('123456', $challenge->code_hash) === false);
        self::assertNull($challenge->consumed_at);

        $challenge->update(['code_hash' => Hash::make('123456')]);

        $verification = $this->postJson('/api/v1/auth/mfa/verify', [
            'code' => '123456',
        ]);

        $verification
            ->assertOk()
            ->assertJsonPath('status', 'authenticated')
            ->assertJsonPath('user.email', $user->email)
            ->assertJsonPath('user.role', 'platform-admin');

        $this->assertAuthenticatedAs($user);
        self::assertNotNull($challenge->fresh()->consumed_at);
        $this->assertDatabaseHas('audit_events', [
            'actor_id' => $user->id,
            'action' => 'authentication.mfa.verified',
        ]);
    }

    public function test_invalid_mfa_code_increments_attempts_without_authenticating(): void
    {
        config()->set('security.email_mfa.enabled', true);

        $user = $this->createPlatformAdmin();

        $this->postJson('/api/v1/auth/login', [
            'email' => $user->email,
            'password' => 'correct-password',
        ])->assertOk();

        $challenge = EmailMfaChallenge::query()->sole();

        $this->postJson('/api/v1/auth/mfa/verify', [
            'code' => '000000',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('code');

        $this->assertGuest();
        self::assertSame(1, $challenge->fresh()->attempt_count);
        $this->assertDatabaseHas('audit_events', [
            'actor_id' => $user->id,
            'action' => 'authentication.mfa.verification_rejected',
        ]);
    }

    public function test_bootstrap_command_creates_once_and_only_resets_with_an_explicit_option(): void
    {
        config()->set('security.bootstrap_admin.email', 'azis213@gmail.com');
        config()->set('security.bootstrap_admin.initial_password', 'first-configured-password');

        $this->artisan('tcp:bootstrap-platform-admin')->assertSuccessful();

        $user = User::query()->sole();
        self::assertSame('azis213@gmail.com', $user->email);
        self::assertSame('platform-admin', $user->role);
        self::assertTrue(Hash::check('first-configured-password', $user->password));

        config()->set('security.bootstrap_admin.initial_password', 'second-configured-password');

        $this->artisan('tcp:bootstrap-platform-admin')->assertSuccessful();
        self::assertTrue(Hash::check('first-configured-password', $user->fresh()->password));

        $this->artisan('tcp:bootstrap-platform-admin', [
            '--reset-password' => true,
        ])->assertSuccessful();

        self::assertTrue(Hash::check('second-configured-password', $user->fresh()->password));
        $this->assertDatabaseHas('audit_events', [
            'object_id' => $user->id,
            'action' => 'authentication.bootstrap_admin.password_reset',
        ]);
    }

    private function createPlatformAdmin(): User
    {
        return User::query()->create([
            'email' => 'azis213@gmail.com',
            'password' => Hash::make('correct-password'),
            'role' => 'platform-admin',
            'is_active' => true,
        ]);
    }
}
