<?php

namespace App\Providers;

use App\Services\FakeTagCodecClient;
use App\Services\InternalHttpTagCodecClient;
use App\Services\TagCodecClient;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(TagCodecClient::class, function (): TagCodecClient {
            if (config('security.tag_codec.driver') !== 'http') {
                return new FakeTagCodecClient;
            }

            return new InternalHttpTagCodecClient([
                'base_url' => config('security.tag_codec.base_url'),
                'api_key' => config('security.tag_codec.api_key'),
                'timeout_seconds' => config('security.tag_codec.timeout_seconds'),
            ]);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
