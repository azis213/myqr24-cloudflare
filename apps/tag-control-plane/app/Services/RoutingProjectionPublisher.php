<?php

declare(strict_types=1);

namespace App\Services;

use App\Models\RoutingOutboxEvent;

interface RoutingProjectionPublisher
{
    public function apply(RoutingOutboxEvent $event): void;
}
