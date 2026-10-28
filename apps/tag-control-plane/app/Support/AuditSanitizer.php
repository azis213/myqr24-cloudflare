<?php

declare(strict_types=1);

namespace App\Support;

final class AuditSanitizer
{
    /**
     * @param array<string, mixed> $metadata
     * @return array<string, mixed>
     */
    public static function sanitize(array $metadata): array
    {
        $sanitized = [];

        foreach ($metadata as $key => $value) {
            if (preg_match('/(authorization|cookie|credential|password|pin|secret|token|api[_-]?key|session)/i', $key) === 1) {
                $sanitized[$key] = '[redacted]';

                continue;
            }

            $sanitized[$key] = is_array($value)
                ? self::sanitize($value)
                : $value;
        }

        return $sanitized;
    }
}
