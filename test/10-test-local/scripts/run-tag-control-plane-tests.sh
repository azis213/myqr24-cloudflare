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
export TCP_TAG_CODEC_DRIVER=fake
export TCP_TAG_CODEC_BASE_URL="http://tag-codec:8788"
export TCP_TAG_CODEC_API_KEY="${LOCAL_CODEC_API_KEY:?LOCAL_CODEC_API_KEY must be set for local tests}"
export TCP_TAG_CODEC_TIMEOUT_SECONDS=3

codec_ready=false
for attempt in $(seq 1 45); do
  if curl --silent --show-error --fail \
    --header "Authorization: Bearer ${TCP_TAG_CODEC_API_KEY}" \
    --header 'Content-Type: application/json' \
    --data '{"length":6,"values":["60466176"]}' \
    "${TCP_TAG_CODEC_BASE_URL}/api/v1/codec/encode-batch" >/dev/null; then
    codec_ready=true
    break
  fi

  sleep 1
done

if [ "$codec_ready" != true ]; then
  echo 'The local private codec worker did not become ready.' >&2
  exit 1
fi

php artisan migrate:fresh --force --no-interaction --database=mysql
./vendor/bin/phpunit --testdox
