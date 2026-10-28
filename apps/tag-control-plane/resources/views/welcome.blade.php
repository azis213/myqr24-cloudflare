<!doctype html>
<html lang="de">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>myQR24 TAG Control Plane – lokale Testumgebung</title>
    <style>
        :root {
            color-scheme: light;
            font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            background: #f5f7fb;
            color: #172033;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 2rem;
        }

        main {
            width: min(100%, 48rem);
            background: #fff;
            border: 1px solid #dce3f0;
            border-radius: 1rem;
            box-shadow: 0 1rem 3rem rgb(23 32 51 / 9%);
            overflow: hidden;
        }

        header {
            padding: 2rem;
            background: #162b4d;
            color: #fff;
        }

        h1 {
            margin: 0;
            font-size: clamp(1.6rem, 4vw, 2.25rem);
        }

        header p {
            margin: .75rem 0 0;
            color: #d7e5ff;
        }

        section {
            padding: 2rem;
        }

        h2 {
            margin: 0 0 1rem;
            font-size: 1.15rem;
        }

        p {
            line-height: 1.55;
        }

        .status {
            display: inline-flex;
            align-items: center;
            gap: .55rem;
            padding: .5rem .75rem;
            border-radius: 999px;
            background: #e7f8ee;
            color: #12663b;
            font-weight: 700;
        }

        .status::before {
            content: "";
            width: .6rem;
            height: .6rem;
            border-radius: 50%;
            background: currentColor;
        }

        ul {
            padding-left: 1.25rem;
        }

        li + li {
            margin-top: .65rem;
        }

        a {
            color: #075db6;
            font-weight: 650;
        }

        code {
            padding: .12rem .3rem;
            background: #eef2f7;
            border-radius: .25rem;
        }

        footer {
            padding: 1rem 2rem;
            border-top: 1px solid #e4e9f2;
            color: #596579;
            font-size: .9rem;
        }
    </style>
</head>
<body>
    <main>
        <header>
            <h1>TAG Control Plane</h1>
            <p>Lokale manuelle Testumgebung</p>
        </header>

        <section>
            <p class="status">TCP läuft</p>

            <h2>Aktueller Implementierungsstand</h2>
            <p>
                Dieses Laravel-Projekt enthält derzeit die technische Basis für MySQL,
                Audit-Events und Korrelations-IDs. Fachliche Verwaltungsoberflächen und
                das TAG Control Center sind noch nicht implementiert.
            </p>

            <h2>Lokale Prüfpfade</h2>
            <ul>
                <li><a href="/api/v1/health">API-Healthcheck</a> – liveness ohne Datenbankzugriff</li>
                <li><a href="/api/v1/ready">API-Readinesscheck</a> – prüft die MySQL-Verbindung</li>
            </ul>

            <p>
                Die lokale Umgebung wird über <code>npm run local:up</code> gestartet.
                Sie verwendet ausschließlich synthetische lokale Daten.
            </p>
        </section>

        <footer>
            myQR24 · TAG Control Plane · lokale Testtopologie
        </footer>
    </main>
</body>
</html>
