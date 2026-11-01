<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\AllocationPool;
use App\Models\FeatureDefinition;
use App\Models\RoutingFeatureAssignment;
use App\Models\TagAllocation;
use App\Models\TagGroup;
use App\Models\TagRange;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final class RoutingAdministrationService
{
    private const IDENTIFIER = '/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/';

    public function __construct(
        private readonly RoutingFeatureValidator $validator,
        private readonly AuditService $audit,
    ) {
    }

    public function saveFeature(User $user, string $featureId, array $definition, string $correlationId): array
    {
        $definition = $this->validator->validate($definition, $featureId);
        return DB::transaction(function () use ($user, $featureId, $definition, $correlationId): array {
            $existing = FeatureDefinition::query()->lockForUpdate()->where('feature_id', $featureId)->first();
            $feature = FeatureDefinition::query()->updateOrCreate(['feature_id' => $featureId], ['definition' => $definition]);
            $references = $this->references($featureId);
            $this->audit->record($correlationId, 'user', $user->id, 'routing_feature', $feature->id, 'routing.feature.saved', ['featureId' => $featureId, 'type' => $definition['type'], 'references' => $references, 'created' => $existing === null]);
            return ['feature' => [...$definition, 'references' => $references]];
        });
    }

    public function assign(User $user, string $scope, string $targetId, array $featureIds, string $correlationId): array
    {
        if (! in_array($scope, ['tag', 'pool', 'range', 'group'], true) || preg_match(self::IDENTIFIER, $targetId) !== 1 || count($featureIds) > 32 || $featureIds !== array_values($featureIds)) {
            throw new InvalidArgumentException('Invalid assignment request.');
        }
        if (count($featureIds) !== count(array_unique($featureIds))) {
            throw new InvalidArgumentException('Duplicate feature reference.');
        }
        foreach ($featureIds as $featureId) {
            if (! is_string($featureId) || preg_match(self::IDENTIFIER, $featureId) !== 1) {
                throw new InvalidArgumentException('Invalid feature reference.');
            }
        }
        $known = FeatureDefinition::query()->whereIn('feature_id', $featureIds)->count();
        if ($known !== count($featureIds)) {
            throw new InvalidArgumentException('Unknown feature reference.');
        }

        return DB::transaction(function () use ($user, $scope, $targetId, $featureIds, $correlationId): array {
            if ($scope === 'group') {
                TagGroup::query()->updateOrCreate(['group_id' => $targetId], ['feature_ids' => array_values($featureIds)]);
            } else {
                $target = $this->target($scope, $targetId);
                $foreignKey = match ($scope) {
                    'range' => 'range_id', 'pool' => 'pool_id', 'tag' => 'tag_allocation_id',
                };
                $query = RoutingFeatureAssignment::query()->where('scope', $scope)->where($foreignKey, $target->id);
                if ($featureIds === []) {
                    $query->delete();
                } else {
                    $query->updateOrCreate(['scope' => $scope, $foreignKey => $target->id], [
                        'range_id' => $scope === 'range' ? $target->id : null,
                        'pool_id' => $scope === 'pool' ? $target->id : null,
                        'tag_allocation_id' => $scope === 'tag' ? $target->id : null,
                        'feature_ids' => array_values($featureIds),
                    ]);
                }
            }
            $this->audit->record($correlationId, 'user', $user->id, 'routing_assignment', $scope.':'.$targetId, 'routing.assignment.saved', ['scope' => $scope, 'targetId' => $targetId, 'featureCount' => count($featureIds)]);
            return ['assignment' => ['scope' => $scope, 'targetId' => $targetId, 'featureIds' => array_values($featureIds)]];
        });
    }

    private function target(string $scope, string $targetId): TagRange|AllocationPool|TagAllocation
    {
        $target = match ($scope) {
            'range' => TagRange::query()->lockForUpdate()->where('range_id', $targetId)->first(),
            'pool' => AllocationPool::query()->lockForUpdate()->where('pool_id', $targetId)->where('is_active', true)->first(),
            'tag' => TagAllocation::query()->lockForUpdate()->where('tag_id', $targetId)->where('status', 'ready-to-publish')->first(),
        };
        if ($target === null) {
            throw new InvalidArgumentException('Unknown or ineligible assignment target.');
        }
        return $target;
    }

    public function catalog(): array
    {
        $features = FeatureDefinition::query()->orderBy('feature_id')->get()->map(function (FeatureDefinition $feature): array {
            return [...$feature->definition, 'references' => $this->references($feature->feature_id)];
        })->values()->all();
        $assignments = TagGroup::query()->orderBy('group_id')->get()->map(fn (TagGroup $group): array => [
            'scope' => 'group', 'targetId' => $group->group_id, 'featureIds' => array_values($group->feature_ids),
        ])->all();
        foreach (RoutingFeatureAssignment::query()->with([])->get() as $assignment) {
            $targetId = match ($assignment->scope) {
                'range' => TagRange::query()->find($assignment->range_id)?->range_id,
                'pool' => AllocationPool::query()->find($assignment->pool_id)?->pool_id,
                'tag' => TagAllocation::query()->find($assignment->tag_allocation_id)?->tag_id,
                default => null,
            };
            if ($targetId !== null) {
                $assignments[] = ['scope' => $assignment->scope, 'targetId' => $targetId, 'featureIds' => array_values($assignment->feature_ids)];
            }
        }
        usort($assignments, fn (array $a, array $b): int => [$a['scope'], $a['targetId']] <=> [$b['scope'], $b['targetId']]);

        return [
            'environment' => config('security.routing_publisher.environment'),
            'supportedFeatureTypes' => ['redirect', 'image', 'json'],
            'supportedScopes' => ['tag', 'pool', 'range', 'group'],
            'features' => $features,
            'assignments' => $assignments,
            'targets' => [
                'groups' => TagGroup::query()->orderBy('group_id')->pluck('group_id')->all(),
                'ranges' => TagRange::query()->orderBy('range_id')->pluck('range_id')->all(),
                'pools' => AllocationPool::query()->where('is_active', true)->orderBy('pool_id')->pluck('pool_id')->all(),
                'tags' => TagAllocation::query()->where('status', 'ready-to-publish')->whereNotNull('tag_id')->orderBy('tag_id')->pluck('tag_id')->all(),
            ],
        ];
    }

    private function references(string $featureId): array
    {
        $references = ['tag' => 0, 'pool' => 0, 'range' => 0, 'group' => 0];
        foreach (TagGroup::query()->get(['feature_ids']) as $group) {
            if (in_array($featureId, $group->feature_ids, true)) {
                $references['group']++;
            }
        }
        foreach (RoutingFeatureAssignment::query()->get(['scope', 'feature_ids']) as $assignment) {
            if (isset($references[$assignment->scope]) && in_array($featureId, $assignment->feature_ids, true)) {
                $references[$assignment->scope]++;
            }
        }
        return $references;
    }
}
