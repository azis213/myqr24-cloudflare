# Lokaler TAG Codec – vollständige Nutzung im Docker-Teststack

Diese Anleitung beschreibt den aktuellen lokalen Codec der Docker-Testumgebung:

- Erreichbarkeit vom Windows-Host über **`http://127.0.0.1:8788`**
- Erreichbarkeit aus dem Compose-Netz über **`http://tag-codec:8788`**
- Bearer-Authentifizierung mit `LOCAL_CODEC_API_KEY`
- **keine öffentliche Bindung** und keine `0.0.0.0`-Veröffentlichung

Der Codec bleibt ein internes Server-Werkzeug für TCP. TCC und Browser dürfen ihn nicht direkt aufrufen.

---

## 1. Sicherheitsmodell und Adressen

Die Veröffentlichung erfolgt ausschließlich an Loopback:

```yaml
ports:
  - "127.0.0.1:${LOCAL_CODEC_PORT:-8788}:8788"
```

Damit gilt:

| Zugriffsweg | Adresse | Erlaubt |
| --- | --- | --- |
| Windows-Host | `http://127.0.0.1:8788` | ja, für lokale Tests |
| TCP-/Codec-Container | `http://tag-codec:8788` | ja |
| LAN / andere Rechner | `http://<deine-ip>:8788` | nein |
| Internet/Staging | keine öffentliche Route | nein |

`127.0.0.1` ist **nicht** „public“. Der Port ist nur auf dem lokalen Rechner gebunden. Eine Bindung an `0.0.0.0` ist für diesen Codec nicht vorgesehen.

Die API verlangt immer:

```http
Authorization: Bearer <LOCAL_CODEC_API_KEY>
Content-Type: application/json
```

---

## 2. Relevante Dateien und Werte

| Datei/Wert | Bedeutung |
| --- | --- |
| `test/10-test-local/compose.yaml` | Compose-Service `tag-codec`, Port `127.0.0.1:8788`, internes Netz `local_test` |
| `test/10-test-local/.env.local` | lokale Ports, synthetische Secrets, u. a. `LOCAL_CODEC_API_KEY` |
| `apps/edge-router/wrangler.codec.toml` | Worker-Konfiguration des Codec |
| `apps/edge-router/src/codec-worker.ts` | API-Routen, Validierung und Bearer-Auth |
| `test/00-Test-Scripts/start-cloudflare-test-env.ps1` | startet den vollständigen Stack inklusive Codec-Smoke |
| `test/00-Test-Scripts/start-codec-worker.ps1` | alternativer Codec-Worker direkt auf dem Host |

Benötigte Werte in `.env.local`:

```dotenv
LOCAL_CODEC_PORT=8788
LOCAL_CODEC_API_KEY=<synthetischer-lokaler-service-key>
LOCAL_CODEC_FEISTEL_SECRET=<mindestens-32-synthetische-local-bytes>
```

Beim ersten Start wird `.env.local` aus `.env.example` erzeugt. Fehlende Werte werden durch die Startskripte ergänzt. Es dürfen ausschließlich synthetische lokale Werte verwendet werden.

Nicht verwenden:

- keine Staging-/Produktions-Secrets,
- keine echten Cloudflare-API-Tokens,
- keine Kopie von `apps/edge-router/.dev.vars` für den Compose-Codec.

---

## 3. Gesamte lokale Umgebung starten

Aus dem Repository-Root:

```powershell
npm run local:cloudflare
```

Alternativ direkt:

```powershell
.\test\00-Test-Scripts\start-cloudflare-test-env.ps1
```

Das Skript startet den bestehenden TCP/TCC/TAG-App-Stack und zusätzlich:

- `tag-codec`
- `tag-media-signer`
- `tag-app-api`
- `edge-router`

Außerdem werden D1/R2/KV geseedet und Smoke-Tests ausgeführt. Der Codec-Smoke ruft dabei authentifiziert `POST /api/v1/codec/decode` auf.

Erwartete Ausgabe am Ende:

```text
App API smoke OK: public session, D1/R2 content and fail-closed media signer.
Edge Router smoke OK: 302|https://app.localhost/tag/ab12cd...
Codec API smoke OK: authenticated decode on http://127.0.0.1:8788

Cloudflare Docker test environment is ready.
...
Codec API (loopback): http://127.0.0.1:8788/
```

Wenn die Umgebung bereits läuft und nur der Codec neu erstellt werden soll:

```powershell
docker compose `
  --env-file test/10-test-local/.env.local `
  -f test/10-test-local/compose.yaml `
  --profile cloudflare `
  up -d --force-recreate tag-codec
```

Smoke-Tests überspringen, z. B. bei reiner Container-Diagnose:

```powershell
.\test\00-Test-Scripts\start-cloudflare-test-env.ps1 -SkipSmoke
```

---

## 4. Prüfen, ob der Codec lokal erreichbar ist

Portbindung prüfen:

```powershell
docker compose `
  --env-file test/10-test-local/.env.local `
  -f test/10-test-local/compose.yaml `
  ps tag-codec
```

Erwartete Zeile:

```text
... 127.0.0.1:8788->8788/tcp
```

Zusätzlich auf Windows:

```powershell
Get-NetTCPConnection -LocalPort 8788 -State Listen
```

Dann einen authentifizierten Decode-Aufruf ausführen:

```powershell
$key = (Get-Content test/10-test-local/.env.local |
    Where-Object { $_ -match '^LOCAL_CODEC_API_KEY=(.*)$' } |
    ForEach-Object { $Matches[1] })

$body = @{ tagId = 'ab12cd' } | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Method Post `
  -Uri 'http://127.0.0.1:8788/api/v1/codec/decode' `
  -Headers @{ Authorization = "Bearer $key" } `
  -ContentType 'application/json' `
  -Body $body
```

Beispielantwort mit der aktuellen lokalen Konfiguration:

```json
{
  "tag": {
    "id": "ab12cd",
    "length": 6,
    "value": "88302009"
  },
  "codecVersion": "S01"
}
```

Der konkrete `value` hängt vom verwendeten `FEISTEL_SECRET_S01` ab. Wenn du den Wert zum Encoden verwendest, immer den aktuellen Decode-Wert aus derselben Umgebung nehmen.

---

## 5. Codec-API verwenden

Alle drei Endpunkte sind `POST`-Routen:

```text
POST /api/v1/codec/decode
POST /api/v1/codec/encode
POST /api/v1/codec/encode-batch
```

### 5.1 Decode

```powershell
$key = (Get-Content test/10-test-local/.env.local |
    Where-Object { $_ -match '^LOCAL_CODEC_API_KEY=(.*)$' } |
    ForEach-Object { $Matches[1] })

Invoke-RestMethod `
  -Method Post `
  -Uri 'http://127.0.0.1:8788/api/v1/codec/decode' `
  -Headers @{ Authorization = "Bearer $key" } `
  -ContentType 'application/json' `
  -Body (@{ tagId = 'ab12cd' } | ConvertTo-Json -Compress)
```

`tagId` muss aus 6, 8 oder 10 Base36-Zeichen bestehen.

### 5.2 Encode

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri 'http://127.0.0.1:8788/api/v1/codec/encode' `
  -Headers @{ Authorization = "Bearer $key" } `
  -ContentType 'application/json' `
  -Body (@{ length = 6; value = '88302009' } | ConvertTo-Json -Compress)
```

`length` muss `6`, `8` oder `10` sein. `value` muss ein kanonischer Dezimalstring für die jeweilige Länge sein. Für die aktuelle lokale Konfiguration ergibt `88302009` wieder `ab12cd`; nach einer Änderung des Feistel-Secrets ist der Decode-Wert erneut zu ermitteln.

### 5.3 Batch-Encode

```powershell
Invoke-RestMethod `
  -Method Post `
  -Uri 'http://127.0.0.1:8788/api/v1/codec/encode-batch' `
  -Headers @{ Authorization = "Bearer $key" } `
  -ContentType 'application/json' `
  -Body (@{
    length = 6
    values = @('88302009', '88302010')
  } | ConvertTo-Json -Compress)
```

Grenzen:

- maximal 1.000 Werte pro Batch,
- maximal 256 KiB Request-Body,
- keine doppelten Werte im Batch,
- jeder Wert muss kanonisch für die gewählte Länge sein.

### 5.4 Alternative mit `curl.exe`

In PowerShell ist `curl` ein Alias für `Invoke-WebRequest`. Für echte curl-Aufrufe `curl.exe` verwenden:

```powershell
curl.exe -sS -X POST "http://127.0.0.1:8788/api/v1/codec/decode" `
  -H "Authorization: Bearer $key" `
  -H "Content-Type: application/json" `
  -d '{"tagId":"ab12cd"}'
```

---

## 6. Zugriff aus TCP und anderen Containern

Innerhalb des Compose-Netzes bleibt die Adresse:

```text
http://tag-codec:8788
```

TCP erhält den Service-Key über:

```text
LOCAL_CODEC_API_KEY
```

Der Codec ist kein Browser-/TCC-Endpunkt. Die TCP-Konfiguration verwendet ihn serverseitig; TCC und die TAG-App erhalten weder die interne Adresse noch den Service-Key.

Ein manueller Test aus einem Einmal-Container im Compose-Netz:

```powershell
$key = (Get-Content test/10-test-local/.env.local |
    Where-Object { $_ -match '^LOCAL_CODEC_API_KEY=(.*)$' } |
    ForEach-Object { $Matches[1] })

docker run --rm --network myqr24-local-test_local_test curlimages/curl:latest `
  -sS -X POST "http://tag-codec:8788/api/v1/codec/decode" `
  -H "Authorization: Bearer $key" `
  -H "Content-Type: application/json" `
  -d '{"tagId":"ab12cd"}'
```


---

## 7. Alternativer Host-Codec

Für Debugging ohne Compose gibt es weiterhin:

```powershell
.\test\00-Test-Scripts\start-codec-worker.ps1
```

Dieser Worker läuft direkt auf dem Host unter:

```text
http://127.0.0.1:8788
```

Der Key kommt aus `apps/edge-router/.dev.vars`:

```text
TAG_CODEC_API_KEY_S01
```

Beispiel:

```powershell
$key = (Get-Content apps/edge-router/.dev.vars |
    Where-Object { $_ -match '^TAG_CODEC_API_KEY_S01=(.*)$' } |
    ForEach-Object { $Matches[1] })

Invoke-RestMethod `
  -Method Post `
  -Uri 'http://127.0.0.1:8788/api/v1/codec/decode' `
  -Headers @{ Authorization = "Bearer $key" } `
  -ContentType 'application/json' `
  -Body (@{ tagId = 'ab12cd' } | ConvertTo-Json -Compress)
```

Wichtig:

- **Nicht gleichzeitig** mit dem Compose-Codec starten. Beide belegen Port `8788`.
- Der Host-Codec verwendet `FEISTEL_SECRET_S01` aus `apps/edge-router/.dev.vars`.
- Der Compose-Codec verwendet `LOCAL_CODEC_FEISTEL_SECRET` aus `.env.local`.
- Unterschiedliche Feistel-Secrets erzeugen unterschiedliche TAG-IDs. Für TCP-/Docker-Tests immer den Compose-Codec verwenden.

---

## 8. Codec stoppen und neu starten

Nur den Compose-Codec neu starten:

```powershell
docker compose `
  --env-file test/10-test-local/.env.local `
  -f test/10-test-local/compose.yaml `
  --profile cloudflare `
  restart tag-codec
```

Nur den Compose-Codec stoppen:

```powershell
docker compose `
  --env-file test/10-test-local/.env.local `
  -f test/10-test-local/compose.yaml `
  --profile cloudflare `
  stop tag-codec
```

Codec-Logs ansehen:

```powershell
docker compose `
  --env-file test/10-test-local/.env.local `
  -f test/10-test-local/compose.yaml `
  --profile cloudflare `
  logs --follow tag-codec
```

Der Codec hat keinen persistenten Testzustand; ein Neustart ist unkritisch.

---

## 9. Fehlerbehebung

| Symptom | Wahrscheinliche Ursache | Lösung |
| --- | --- | --- |
| `401 {"error":{"code":"unauthorized"}}` | falscher/leerer Bearer-Key | `LOCAL_CODEC_API_KEY` aus `.env.local` verwenden; Header prüfen |
| `404 {"error":{"code":"not_found"}}` | falscher Pfad | exakt `/api/v1/codec/decode`, `/encode` oder `/encode-batch` verwenden |
| `405 Method Not Allowed` | `GET` statt `POST` | Methode auf `POST` ändern |
| `400 {"error":{"code":"invalid_request"}}` | ungültiges JSON, falscher Content-Type, ungültige Länge/Wert | `Content-Type: application/json`, kanonischen Dezimalstring und gültige Länge verwenden |
| `500 {"error":{"code":"codec_unavailable"}}` | Feistel-Secret fehlt/ungültig oder Codec-Konfiguration defekt | Codec-Logs prüfen, `.env.local`/`LOCAL_CODEC_FEISTEL_SECRET` prüfen, Codec neu erstellen |
| `Connection refused` auf `127.0.0.1:8788` | Codec läuft nicht oder Port nicht veröffentlicht | `docker compose ps tag-codec`; Codec starten/neu erstellen |
| Port `8788` bereits belegt | Host-Codec läuft noch | Host-Codec mit `Ctrl+C` beenden oder `LOCAL_CODEC_PORT` ändern |
| `tagId` wird nicht gefunden | TAG wurde mit anderem Feistel-Secret erzeugt | Codec und erzeugende Umgebung müssen dasselbe Secret verwenden |

Wenn du `LOCAL_CODEC_PORT` änderst, passe auch die Host-URL in deinen Tests an:

```dotenv
LOCAL_CODEC_PORT=8798
```

Danach Codec neu erstellen:

```powershell
docker compose `
  --env-file test/10-test-local/.env.local `
  -f test/10-test-local/compose.yaml `
  --profile cloudflare `
  up -d --force-recreate tag-codec
```

Die interne Adresse `http://tag-codec:8788` bleibt unverändert, weil im Container weiterhin Port `8788` verwendet wird.


---

## 10. Reset

Nur den Cloudflare-Testzustand inklusive API/Edge/Media-Signer zurücksetzen:

```powershell
npm run local:cloudflare:reset
```

Der Codec ist zustandslos und wird dabei nicht neu geseedet. Für einen vollständigen lokalen Reset inklusive aller Compose-Daten:

```powershell
.\test\10-test-local\scripts\reset-local-test.ps1 -Force
```

---

## 11. Sicherheitsregeln

- Codec niemals an `0.0.0.0` binden.
- `LOCAL_CODEC_API_KEY` nicht in Browser-Code, TCC oder Logs veröffentlichen.
- `.env.local` und `.dev.vars` niemals committen.
- Keine Staging-/Produktions-Secrets lokal wiederverwenden.
- Codec-Aufrufe nur serverseitig aus TCP oder lokalen Diagnosewerkzeugen.
- Nach Änderungen an Secrets den Codec neu erstellen, nicht nur den Prozess warm neu laden.

---

## 12. Kurzreferenz

```text
Host:             http://127.0.0.1:8788
Compose-intern:   http://tag-codec:8788
Auth:             Authorization: Bearer <LOCAL_CODEC_API_KEY>
Content-Type:     application/json
Methoden:         POST
Routen:           /api/v1/codec/decode
                  /api/v1/codec/encode
                  /api/v1/codec/encode-batch
Start:            npm run local:cloudflare
Reset:            npm run local:cloudflare:reset
```

