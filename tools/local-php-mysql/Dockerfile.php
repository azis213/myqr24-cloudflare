FROM php:8.4-cli-alpine

RUN apk add --no-cache \
        git \
        unzip \
    && docker-php-ext-install pdo_mysql \
    && php -m | grep -qx 'PDO' \
    && php -m | grep -qx 'pdo_mysql'

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer

WORKDIR /workspace

ENTRYPOINT ["php"]
