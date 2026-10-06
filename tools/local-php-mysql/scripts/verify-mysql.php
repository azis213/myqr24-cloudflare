<?php

declare(strict_types=1);

function requiredEnvironment(string $name): string
{
    $value = getenv($name);

    if (!is_string($value) || $value === '') {
        throw new RuntimeException(sprintf('Missing required environment variable: %s', $name));
    }

    return $value;
}

$databaseName = requiredEnvironment('MYSQL_DATABASE');
$dsn = sprintf(
    'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
    requiredEnvironment('MYSQL_HOST'),
    requiredEnvironment('MYSQL_PORT'),
    $databaseName,
);

$pdo = new PDO(
    $dsn,
    requiredEnvironment('MYSQL_USER'),
    requiredEnvironment('MYSQL_PASSWORD'),
    [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_EMULATE_PREPARES => false,
    ],
);

$tableName = 'w0_local_mysql_verification';

try {
    $charset = (string) $pdo->query('SELECT @@character_set_connection')->fetchColumn();
    $timeZone = (string) $pdo->query('SELECT @@session.time_zone')->fetchColumn();

    if ($charset !== 'utf8mb4') {
        throw new RuntimeException(sprintf('Expected utf8mb4 connection charset, received %s.', $charset));
    }

    if ($timeZone !== '+00:00') {
        throw new RuntimeException(sprintf('Expected UTC session timezone, received %s.', $timeZone));
    }

    $pdo->exec(sprintf(
        'CREATE TABLE `%s` (id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, label VARCHAR(64) NOT NULL) ENGINE=InnoDB',
        $tableName,
    ));

    $insert = $pdo->prepare(sprintf('INSERT INTO `%s` (label) VALUES (:label)', $tableName));

    $pdo->beginTransaction();
    $insert->execute(['label' => 'committed']);
    $pdo->commit();

    $pdo->beginTransaction();
    $insert->execute(['label' => 'rolled-back']);
    $pdo->rollBack();

    $labels = $pdo->query(sprintf('SELECT label FROM `%s` ORDER BY id', $tableName))
        ->fetchAll(PDO::FETCH_COLUMN);

    if ($labels !== ['committed']) {
        throw new RuntimeException('Commit/rollback verification returned an unexpected row set.');
    }

    fwrite(STDOUT, sprintf(
        "Local MySQL verification passed: MySQL connectivity, utf8mb4, UTC, commit, and rollback (%s).%s",
        $databaseName,
        PHP_EOL,
    ));
} finally {
    $pdo->exec(sprintf('DROP TABLE IF EXISTS `%s`', $tableName));
}
