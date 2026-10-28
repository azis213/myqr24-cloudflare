#!/bin/sh
set -eu

cd /workspace/tag-control-plane

if [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction --prefer-dist
fi

export APP_ENV=testing
export APP_KEY="${APP_KEY:?APP_KEY must be set for local tests}"
export APP_TIMEZONE=UTC
export DB_CONNECTION=mysql
export DB_HOST="${DB_HOST:?DB_HOST must be set for local tests}"
export DB_PORT="${DB_PORT:-3306}"
export DB_DATABASE="${TEST_DB_DATABASE:?TEST_DB_DATABASE must be set for local tests}"
export DB_USERNAME="${DB_USERNAME:?DB_USERNAME must be set for local tests}"
export DB_PASSWORD="${DB_PASSWORD:?DB_PASSWORD must be set for local tests}"
export DB_CHARSET=utf8mb4
export DB_COLLATION=utf8mb4_0900_ai_ci
export CACHE_STORE=array
export QUEUE_CONNECTION=sync
export SESSION_DRIVER=array

php artisan migrate:fresh --force --no-interaction --database=mysql
./vendor/bin/phpunit --testdox
