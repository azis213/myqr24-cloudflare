# myQR24 Tag Lab

Lokale Webanwendung zum Anzeigen, Drucken und Erzeugen kryptografisch gültiger Staging-Testtags als QR-Codes.

## Start

Voraussetzungen:

- Node.js und die Projektabhängigkeiten sind installiert;
- `.env.staging.local` existiert im Projekt-Root;
- die Datei enthält mindestens `FEISTEL_SECRET_S01`.

Starten:

```sh
npm run tag-lab
```

Danach im Browser öffnen:

```text
http://127.0.0.1:8788
```

Der Server lauscht absichtlich nur auf `127.0.0.1`. Die Benutzeroberfläche ist somit nur auf dem lokalen Rechner erreichbar; der Feistel-Schlüssel wird niemals an einen Browser oder ein Mobilgerät übertragen.

## QR-Code mit dem Mobilgerät scannen

Die QR-Codes enthalten keine lokale URL. Sie enthalten die öffentliche Staging-Scan-URL:

```text
https://s.qx4.uk/{tagId}
```

Dadurch kann ein Smartphone den Code direkt mit Kamera oder QR-Scanner lesen und die öffentliche Cloudflare-Staging-Strecke testen. Das Smartphone muss lediglich Internetzugriff haben; es muss nicht das lokale Tag Lab erreichen können.

## Tag-Zustände

| Anzeige | Bedeutung |
| --- | --- |
| `Konfiguriert` | Der Tag ist als bekannte lokale Staging-Testtag-ID in `TEST_TAGS` eingetragen. Dies ist eine lokale Kennzeichnung; die tatsächliche Plattformkonfiguration bleibt in Cloudflare KV maßgeblich. |
| `Noch nicht konfiguriert` | Der Tag ist kryptografisch valide erzeugt, besitzt aber absichtlich keine KV-Range-/Feature-Konfiguration. Ein öffentlicher Scan führt deshalb derzeit fail-closed zu `404 Not Found`. Er eignet sich für spätere Claiming-, Provisioning- und Plattformtests. |

Die lokale Registry erzeugter Tags liegt unter:

```text
.tag-lab/staging-tags.json
```

Sie ist per `.gitignore` ausgeschlossen und darf nicht manuell ins Repository übernommen werden.

## Bekannte Testtags hinzufügen

In der lokal ignorierten Datei `.env.staging.local` können bekannte Tags kommagetrennt registriert werden:

```dotenv
FEISTEL_SECRET_S01=<lokaler-staging-feistel-schlüssel>
TEST_TAGS=beispiel1,beispiel2
```

Die IDs erscheinen beim nächsten Start des Tag Labs in der Liste. Die Datei darf keine produktiven Secrets, Tokens oder sonstige Zugangsdaten in Git enthalten.

## Lineare 6-, 8- und 10-stellige Tags

Alle drei unterstützten Längen benötigen ausschließlich den lokalen
`FEISTEL_SECRET_S01`. Das Tag Lab wählt einen zufälligen Wert aus dem jeweiligen
kanonischen Base36-Raum, führt dieselbe Feistel-/Cycle-Walk-Kodierung wie der
Cloudflare Worker aus und erzeugt daraus eine öffentliche Scan-ID.

Der dekodierte Wert bleibt für jede Länge unverändert ein linearer kanonischer
Range-Key. Es gibt keine HMAC-Prüfziffer, 16er-Slots oder eine zusätzliche
lokale Geheimnisabhängigkeit für 8- oder 10-stellige Tags.

## Sicherheit

- Das Tool ist ausschließlich für lokale Staging-Tests vorgesehen.
- Secrets werden nur beim Serverstart aus `.env.staging.local` gelesen.
- API-Antworten und Browseransicht enthalten nur öffentliche Tag-IDs, Scan-URLs und QR-SVGs.
- Die lokale Registry sowie `.env.staging.local` sind von Git ausgeschlossen.
- Ein erzeugter Tag wird nicht automatisch in Cloudflare KV aktiviert und verändert keine Cloudflare-Ressource.
- Die Anwendung bindet standardmäßig nur an `127.0.0.1`, nicht an das lokale Netzwerk.
