#!/bin/sh
set -eu

cd /workspace/tag-control-plane

if [ ! -f vendor/autoload.php ]; then
  composer install --no-interaction --prefer-dist
fi

mkdir -p \
  storage/app/private \
  storage/framework/cache/data \
  storage/framework/sessions \
  storage/framework/testing \
  storage/framework/views \
  storage/logs \
  bootstrap/cache

php artisan migrate --force --no-interaction
php artisan tcp:bootstrap-platform-admin --no-interaction

exec php artisan serve --host=0.0.0.0 --port=8000
