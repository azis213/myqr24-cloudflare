<?php

namespace App\Providers;

use App\Services\FakeTagCodecClient;
use App\Services\TagCodecClient;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(TagCodecClient::class, FakeTagCodecClient::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
