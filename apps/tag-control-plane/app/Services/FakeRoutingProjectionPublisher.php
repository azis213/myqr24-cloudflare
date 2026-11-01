<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\RoutingOutboxEvent;
use InvalidArgumentException;

final class FakeRoutingProjectionPublisher implements RoutingProjectionPublisher
{
    private array $documents = [];
    private array $operations = [];
    private array $applied = [];
    private ?string $nextFailure = null;

    public function failNext(string $errorClass): void
    {
        if (! in_array($errorClass, ['timeout', 'rate_limit', 'provider_error'], true)) {
            throw new InvalidArgumentException('Unknown fake failure.');
        }
        $this->nextFailure = $errorClass;
    }

    public function apply(RoutingOutboxEvent $event): void
    {
        if ($event->environment !== 'staging') {
            throw new InvalidArgumentException('Fake publisher only accepts staging.');
        }
        $idempotencyKey = $event->environment.'|'.$event->projection_revision_id.'|'.$event->operation;
        if (isset($this->applied[$idempotencyKey])) {
            return;
        }
        if ($this->nextFailure !== null) {
            $failure = $this->nextFailure;
            $this->nextFailure = null;
            throw new RoutingPublisherException($failure);
        }

        $current = $event->documents;
        $previous = $event->previous_documents;
        $keys = array_values(array_unique([...array_keys($previous), ...array_keys($current)]));
        $this->put($event->environment, 'tag-range-index', ['version' => 1, 'ranges' => []]);

        foreach ($keys as $key) {
            if ($this->isDirectRule($key) && ! array_key_exists($key, $current)) {
                $this->delete($event->environment, $key);
            }
        }
        foreach (['feature:', 'group:', 'range-rule:', 'tag:'] as $prefix) {
            $matching = array_values(array_filter($keys, fn (string $key): bool => str_starts_with($key, $prefix)));
            sort($matching);
            foreach ($matching as $key) {
                if (array_key_exists($key, $current)) {
                    $this->put($event->environment, $key, $current[$key]);
                } elseif (! $this->isDirectRule($key)) {
                    $this->delete($event->environment, $key);
                }
            }
        }
        $this->put($event->environment, 'tag-range-index', $current['tag-range-index'] ?? ['version' => 1, 'ranges' => []]);
        $this->applied[$idempotencyKey] = true;
    }

    public function documents(string $environment = 'staging'): array
    {
        $documents = $this->documents[$environment] ?? [];
        ksort($documents);
        return $documents;
    }

    public function operations(): array
    {
        return $this->operations;
    }

    private function isDirectRule(string $key): bool
    {
        return str_starts_with($key, 'tag:') || str_starts_with($key, 'range-rule:');
    }

    private function put(string $environment, string $key, array $value): void
    {
        $this->documents[$environment][$key] = $value;
        $this->operations[] = ['action' => 'put', 'environment' => $environment, 'key' => $key];
    }

    private function delete(string $environment, string $key): void
    {
        unset($this->documents[$environment][$key]);
        $this->operations[] = ['action' => 'delete', 'environment' => $environment, 'key' => $key];
    }
}
