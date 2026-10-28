<?php

declare(strict_types=1);

namespace Tests\Unit;

use App\Support\AuditSanitizer;
use PHPUnit\Framework\Attributes\Test;
use PHPUnit\Framework\TestCase;

final class AuditSanitizerTest extends TestCase
{
    #[Test]
    public function it_redacts_sensitive_metadata_keys_recursively(): void
    {
        $sanitized = AuditSanitizer::sanitize([
            'message' => 'safe',
            'apiKey' => 'must-not-be-retained',
            'nested' => [
                'sessionToken' => 'must-not-be-retained',
                'count' => 2,
            ],
        ]);

        self::assertSame([
            'message' => 'safe',
            'apiKey' => '[redacted]',
            'nested' => [
                'sessionToken' => '[redacted]',
                'count' => 2,
            ],
        ], $sanitized);
    }
}
