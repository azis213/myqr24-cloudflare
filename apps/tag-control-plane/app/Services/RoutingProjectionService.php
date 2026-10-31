<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\FeatureDefinition;
use App\Models\RoutingFeatureAssignment;
use App\Models\TagAllocation;
use App\Models\TagGroup;
use App\Models\TagRange;
use InvalidArgumentException;

final class RoutingProjectionService
{
    private const IDENTIFIER = '/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/';

    private const PRIVATE_KEYS = ['owner', 'account', 'claim', 'pin', 'session', 'audit', 'token', 'secret', 'password', 'credential', 'vault', 'verification', 'production'];

    /** @return array<string, array<string, mixed>> */
    public function generate(): array
    {
        $ranges = TagRange::query()->get()->sort(fn (TagRange $left, TagRange $right): int => $this->compareDecimal($left->start_value, $right->start_value))->values();
        $groups = TagGroup::query()->get()->keyBy('group_id');
        $features = FeatureDefinition::query()->get()->keyBy('feature_id');
        $assignments = RoutingFeatureAssignment::query()->get();
        $documents = ['tag-range-index' => ['version' => 1, 'ranges' => []]];

        foreach ($ranges as $range) {
            $group = $groups->get($range->group_id);
            if (! $group instanceof TagGroup) {
                throw new InvalidArgumentException('Missing routing group.');
            }
            $this->validateFeatureIds($group->feature_ids, $features->all());
            $documents['tag-range-index']['ranges'][] = [
                'id' => $range->range_id, 'start' => $range->start_value, 'end' => $range->end_value,
                'groupId' => $range->group_id, 'length' => $range->length, 'active' => $range->is_active,
            ];
            $documents['group:'.$group->group_id] = ['id' => $group->group_id, 'featureIds' => $group->feature_ids];
        }

        foreach ($assignments as $assignment) {
            $this->validateFeatureIds($assignment->feature_ids, $features->all());
            if ($assignment->scope === 'range' && $assignment->range_id !== null) {
                $range = $ranges->firstWhere('id', $assignment->range_id);
                if (! $range instanceof TagRange) {
                    throw new InvalidArgumentException('Invalid range assignment.');
                }
                $documents['range-rule:'.$range->range_id] = ['featureIds' => $assignment->feature_ids];
            }
            if ($assignment->scope === 'tag' && $assignment->tag_allocation_id !== null) {
                $tag = TagAllocation::query()->find($assignment->tag_allocation_id);
                if (! $tag instanceof TagAllocation || $tag->tag_id === null || $tag->status !== 'ready-to-publish') {
                    throw new InvalidArgumentException('Invalid tag assignment.');
                }
                $documents['tag:'.$tag->decoded_value] = ['featureIds' => $assignment->feature_ids];
            }
        }

        foreach ($features as $feature) {
            $this->validateFeature($feature);
            $documents['feature:'.$feature->feature_id] = $feature->definition;
        }

        return $documents;
    }

    /** @param array<int, string> $featureIds @param array<string, FeatureDefinition> $features */
    private function validateFeatureIds(array $featureIds, array $features): void
    {
        if (count($featureIds) !== count(array_unique($featureIds))) {
            throw new InvalidArgumentException('Duplicate feature reference.');
        }
        foreach ($featureIds as $featureId) {
            if (! is_string($featureId) || ! preg_match(self::IDENTIFIER, $featureId) || ! isset($features[$featureId])) {
                throw new InvalidArgumentException('Invalid feature reference.');
            }
        }
    }

    private function validateFeature(FeatureDefinition $feature): void
    {
        $definition = $feature->definition;
        if (($definition['id'] ?? null) !== $feature->feature_id || ! in_array($definition['type'] ?? null, ['redirect', 'image', 'json'], true) || ($definition['enabled'] ?? null) !== true) {
            throw new InvalidArgumentException('Invalid feature definition.');
        }
        if ($this->containsPrivateKey($definition)) {
            throw new InvalidArgumentException('Private feature field.');
        }
        if (($definition['type'] ?? null) === 'redirect') {
            $hasUrl = isset($definition['url']) && is_string($definition['url']);
            $hasTemplate = isset($definition['urlTemplate']) && is_string($definition['urlTemplate']);
            if ($hasUrl === $hasTemplate || ! $this->isSafeUrl($hasUrl ? $definition['url'] : $definition['urlTemplate'])) {
                throw new InvalidArgumentException('Invalid redirect feature.');
            }
        }
    }

    private function isSafeUrl(string $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_URL) !== false && str_starts_with($value, 'https://') && ! preg_match('/\{(?!tagId\}|decodedValue\}|length\}|groupId\})/', $value);
    }

    private function containsPrivateKey(array $value): bool
    {
        foreach ($value as $key => $entry) {
            if (is_string($key) && collect(self::PRIVATE_KEYS)->contains(fn (string $privateKey): bool => str_contains(strtolower($key), $privateKey))) {
                return true;
            }
            if (is_array($entry) && $this->containsPrivateKey($entry)) {
                return true;
            }
        }

        return false;
    }

    private function compareDecimal(string $left, string $right): int
    {
        return strlen($left) === strlen($right) ? strcmp($left, $right) : strlen($left) <=> strlen($right);
    }
}
