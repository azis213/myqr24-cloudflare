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
    public function __construct(
        private readonly RoutingFeatureValidator $features,
        private readonly RoutingRangeValidator $rangeValidator,
    ) {
    }

    public function generate(): array
    {
        $compare = $this->rangeValidator->compare(...);
        $ranges = TagRange::query()->get()->sort(fn (TagRange $a, TagRange $b): int => $compare($a->start_value, $b->start_value))->values();
        $groups = TagGroup::query()->orderBy('group_id')->get()->keyBy('group_id');
        $features = FeatureDefinition::query()->orderBy('feature_id')->get()->keyBy('feature_id');
        $assignments = RoutingFeatureAssignment::query()->get();
        $documents = ['tag-range-index' => ['version' => 1, 'ranges' => []]];
        $used = [];
        $previousEnd = null;

        foreach ($ranges as $range) {
            $this->rangeValidator->validate($range, $previousEnd);
            $previousEnd = $range->end_value;
            $group = $groups->get($range->group_id);
            if (! $group instanceof TagGroup) {
                throw new InvalidArgumentException('Missing routing group.');
            }
            $this->validateReferences($group->feature_ids, $features->all());
            $used += array_fill_keys($group->feature_ids, true);
            $documents['tag-range-index']['ranges'][] = [
                'id' => $range->range_id, 'start' => $range->start_value, 'end' => $range->end_value,
                'groupId' => $range->group_id, 'length' => $range->length, 'active' => $range->is_active,
            ];
            $documents['group:'.$group->group_id] = ['id' => $group->group_id, 'featureIds' => array_values($group->feature_ids)];
        }

        foreach ($assignments->where('scope', 'range') as $assignment) {
            $range = $ranges->firstWhere('id', $assignment->range_id);
            if (! $range instanceof TagRange) {
                throw new InvalidArgumentException('Invalid range assignment.');
            }
            if ($assignment->feature_ids !== []) {
                $this->validateReferences($assignment->feature_ids, $features->all());
                $used += array_fill_keys($assignment->feature_ids, true);
                $documents['range-rule:'.$range->range_id] = ['featureIds' => array_values($assignment->feature_ids)];
            }
        }

        $tagRules = [];
        foreach ($assignments->where('scope', 'pool') as $assignment) {
            $this->validateReferences($assignment->feature_ids, $features->all());
            $tags = TagAllocation::query()->where('pool_id', $assignment->pool_id)->where('status', 'ready-to-publish')->whereNotNull('tag_id')->get();
            foreach ($tags as $tag) {
                $this->materialize($tagRules, $tag, $assignment->feature_ids, $ranges);
                $used += array_fill_keys($assignment->feature_ids, true);
            }
        }
        foreach ($assignments->where('scope', 'tag') as $assignment) {
            $tag = TagAllocation::query()->find($assignment->tag_allocation_id);
            if (! $tag instanceof TagAllocation || $tag->status !== 'ready-to-publish') {
                throw new InvalidArgumentException('Invalid tag assignment.');
            }
            $this->validateReferences($assignment->feature_ids, $features->all());
            if ($assignment->feature_ids === []) {
                unset($tagRules[$tag->decoded_value]);
            } else {
                $this->materialize($tagRules, $tag, $assignment->feature_ids, $ranges);
                $used += array_fill_keys($assignment->feature_ids, true);
            }
        }
        if ($assignments->whereNotIn('scope', ['range', 'pool', 'tag'])->isNotEmpty()) {
            throw new InvalidArgumentException('Unknown assignment scope.');
        }

        uksort($tagRules, fn (int|string $a, int|string $b): int => $compare((string) $a, (string) $b));
        foreach ($tagRules as $value => $ids) {
            $documents['tag:'.$value] = ['featureIds' => $ids];
        }
        foreach ($features as $feature) {
            if (isset($used[$feature->feature_id])) {
                $documents['feature:'.$feature->feature_id] = $this->features->validate($feature->definition, $feature->feature_id);
            }
        }

        return $documents;
    }

    private function validateReferences(array $ids, array $features): void
    {
        if (count($ids) !== count(array_unique($ids))) {
            throw new InvalidArgumentException('Duplicate feature reference.');
        }
        foreach ($ids as $id) {
            if (! is_string($id) || preg_match('/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/', $id) !== 1 || ! isset($features[$id])) {
                throw new InvalidArgumentException('Invalid feature reference.');
            }
        }
    }

    private function materialize(array &$rules, TagAllocation $tag, array $ids, $ranges): void
    {
        $range = $ranges->firstWhere('id', $tag->range_id);
        if ($tag->tag_id === null || ! $range instanceof TagRange || $range->length !== $tag->length || $this->rangeValidator->compare($tag->decoded_value, $range->start_value) < 0 || $this->rangeValidator->compare($tag->decoded_value, $range->end_value) > 0 || $ids === []) {
            throw new InvalidArgumentException('Invalid materialized tag rule.');
        }
        $rules[$tag->decoded_value] = array_values($ids);
    }
}
