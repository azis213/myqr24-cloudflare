<?php

declare(strict_types=1);

namespace App\Services;

use InvalidArgumentException;

final class RoutingFeatureValidator
{
    private const IDENTIFIER = '/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/';
    private const PRIVATE_KEYS = ['owner', 'account', 'claim', 'pin', 'session', 'audit', 'token', 'secret', 'password', 'credential', 'vault', 'verification', 'production', 'pool'];

    /** @return array<string, mixed> */
    public function validate(array $definition, ?string $expectedId = null): array
    {
        $id = $definition['id'] ?? null;
        $type = $definition['type'] ?? null;
        if (! is_string($id) || preg_match(self::IDENTIFIER, $id) !== 1 || ($expectedId !== null && $id !== $expectedId)) {
            throw new InvalidArgumentException('Invalid feature identifier.');
        }
        if (! in_array($type, ['redirect', 'image', 'json'], true) || ($definition['enabled'] ?? null) !== true) {
            throw new InvalidArgumentException('Invalid feature type or state.');
        }
        if ($this->containsPrivateKey($definition) || strlen(json_encode($definition, JSON_THROW_ON_ERROR)) > 16384) {
            throw new InvalidArgumentException('Feature exceeds public data limits.');
        }

        return match ($type) {
            'redirect' => $this->validateRedirect($definition),
            'image' => $this->validateImage($definition),
            'json' => $this->validateJson($definition),
        };
    }

    /** @return array<string, mixed> */
    private function validateRedirect(array $definition): array
    {
        $this->allowKeys($definition, ['id', 'type', 'enabled', 'url', 'urlTemplate', 'status', 'signing']);
        $hasUrl = isset($definition['url']) && is_string($definition['url']);
        $hasTemplate = isset($definition['urlTemplate']) && is_string($definition['urlTemplate']);
        if ($hasUrl === $hasTemplate) {
            throw new InvalidArgumentException('Redirect needs exactly one destination.');
        }
        $value = $hasUrl ? $definition['url'] : $definition['urlTemplate'];
        $this->validateUrl($value, ['tagId', 'decodedValue', 'length', 'groupId'], false);
        if (isset($definition['status']) && ! in_array($definition['status'], [301, 302, 303, 307, 308], true)) {
            throw new InvalidArgumentException('Invalid redirect status.');
        }
        if (isset($definition['signing'])) {
            $signing = $definition['signing'];
            if (! is_array($signing) || array_keys($signing) !== ['ttlSeconds'] || ! is_int($signing['ttlSeconds']) || $signing['ttlSeconds'] < 10 || $signing['ttlSeconds'] > 300) {
                throw new InvalidArgumentException('Invalid redirect signing policy.');
            }
        }

        return $definition;
    }

    /** @return array<string, mixed> */
    private function validateImage(array $definition): array
    {
        $this->allowKeys($definition, ['id', 'type', 'enabled', 'url']);
        if (! isset($definition['url']) || ! is_string($definition['url'])) {
            throw new InvalidArgumentException('Image needs a public logical media URL.');
        }
        $rendered = $this->validateUrl($definition['url'], ['tagId'], true);
        $path = parse_url($rendered, PHP_URL_PATH);
        if (! is_string($path) || ! str_contains($path, '/media/v1/tags/') || preg_match('/\.(webp|avif)$/', $path) !== 1) {
            throw new InvalidArgumentException('Image URL is not an allowed media variant.');
        }

        return $definition;
    }

    /** @return array<string, mixed> */
    private function validateJson(array $definition): array
    {
        $this->allowKeys($definition, ['id', 'type', 'enabled', 'payload']);

        return $definition;
    }

    private function allowKeys(array $definition, array $allowed): void
    {
        if (array_diff(array_keys($definition), $allowed) !== []) {
            throw new InvalidArgumentException('Unexpected feature field.');
        }
    }

    /** @param array<int, string> $tokens */
    private function validateUrl(string $value, array $tokens, bool $httpsOnly): string
    {
        if (preg_match_all('/\{([^{}]*)\}/', $value, $matches) === false) {
            throw new InvalidArgumentException('Invalid URL template.');
        }
        foreach ($matches[1] as $token) {
            if (! in_array($token, $tokens, true)) {
                throw new InvalidArgumentException('Unknown URL template token.');
            }
        }
        $samples = ['tagId' => 'ab12cd', 'decodedValue' => '60466176', 'length' => '6', 'groupId' => 'group-default'];
        $rendered = str_replace(array_map(fn (string $token): string => '{'.$token.'}', $tokens), array_map(fn (string $token): string => $samples[$token], $tokens), $value);
        if (str_contains($rendered, '{') || str_contains($rendered, '}') || filter_var($rendered, FILTER_VALIDATE_URL) === false) {
            throw new InvalidArgumentException('Invalid absolute URL.');
        }
        $parts = parse_url($rendered);
        $allowedSchemes = $httpsOnly ? ['https'] : ['https', 'http'];
        if (! is_array($parts) || ! in_array(strtolower($parts['scheme'] ?? ''), $allowedSchemes, true) || isset($parts['user']) || isset($parts['pass'])) {
            throw new InvalidArgumentException('Unsafe URL scheme or credentials.');
        }

        return $rendered;
    }

    private function containsPrivateKey(array $value): bool
    {
        foreach ($value as $key => $entry) {
            if (is_string($key)) {
                foreach (self::PRIVATE_KEYS as $privateKey) {
                    if (str_contains(strtolower($key), $privateKey)) {
                        return true;
                    }
                }
            }
            if (is_array($entry) && $this->containsPrivateKey($entry)) {
                return true;
            }
        }

        return false;
    }
}
