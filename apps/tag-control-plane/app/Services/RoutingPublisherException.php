<?php

declare(strict_types=1);

namespace App\Services;

use RuntimeException;

final class RoutingPublisherException extends RuntimeException
{
    public function __construct(public readonly string $errorClass)
    {
        parent::__construct('Routing provider failed.');
    }
}
