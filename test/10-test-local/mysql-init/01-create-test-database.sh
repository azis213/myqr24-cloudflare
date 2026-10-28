#!/bin/sh
set -eu

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<-SQL
    CREATE DATABASE IF NOT EXISTS \`${LOCAL_MYSQL_TEST_DATABASE}\`
        CHARACTER SET utf8mb4
        COLLATE utf8mb4_0900_ai_ci;

    GRANT ALL PRIVILEGES ON \`${LOCAL_MYSQL_TEST_DATABASE}\`.* TO '${MYSQL_USER}'@'%';
    FLUSH PRIVILEGES;
SQL
