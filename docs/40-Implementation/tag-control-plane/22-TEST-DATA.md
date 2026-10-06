# Testdaten und Fixtures: TAG Control Plane

**Planungsstand:** 2026-10-06  
**Status:** Planung. Dieses Dokument definiert ausschließlich künftige Fixture- und Secret-Regeln; es erzeugt keine Datenbank, Konfiguration oder Secrets.

## 1. Grundregeln

1. Fixtures sind synthetisch, deterministisch, umgebungsmarkiert und frei von Produktivdaten.
2. Echte Personen, Kontakte, Betreiber, Standorte, Genehmigungen, Bestellungen, Zahlungsinformationen und Produktionsdaten sind verboten.
3. Feistel-/HMAC-Secrets, Cloudflare-Tokens, Datenbankzugänge, MFA-Secrets und Cookie-/Sessionwerte werden niemals versioniert.
4. Kryptografische Tests verwenden einen isolierten lokalen/CI-Secret-Provider oder freigegebene nichtproduktive Testvektoren außerhalb allgemeiner Fixtures.
5. Staging und Produktion verwenden getrennte Datenbanken, Namespace-IDs, Tokens, Druckvorlagen, Hosts und Secret Stores.
6. Nicht geheime Fixture-Daten dürfen keine Datenfelder enthalten, die später durch KV oder öffentliche API ausgeschlossen sein müssen, außer in ausdrücklich markierten Negativfixtures.
7. Jeder Testlauf nutzt Rollback oder eine isolierte, anschließend bereinigte Datenbank bzw. Sandbox.

## 2. Fixture-Klassen

| ID | Klasse | Zweck | Zulässiger Inhalt | Verboten |
| --- | --- | --- | --- | --- |
| `CP-TD-001` | Range/Gruppe | Range- und Referenzprüfung | kleine kanonische Testbereiche, synthetische Gruppen-/Feature-IDs | Produktionsranges, geheime Derivate |
| `CP-TD-002` | Allocator | Reservierung, Konkurrenz, Retry | Testkorrelationen, Startwerte, reservierte Testobjekte | echte Ausgabelose, Secrets |
| `CP-TD-003` | TAG-Lifecycle | Statusautomat und Sperren | synthetische TAG-Stati, begründete Testaktionen | reale Owner- oder Kundendaten |
| `CP-TD-004` | Produktion/Druck | Lose, Positionen, Snapshot und QA | erfundene Produktklasse, Vorlagenversion, Positionsnummern, QR-Testpayloads | echte Druckdateien, Produktionsserien, private Lieferdaten |
| `CP-TD-005` | Routing-Projektion | Edge-Contract | minimaler Index, Gruppen, Regeln, sichere Feature-Dokumente | Audit, Produktions-, Owner-, POI-, Vault- oder Secretdaten |
| `CP-TD-006` | Publisher-Sandbox | Retry, Publish und Unpublish | Fake-Cloudflare-Adapter, simulierte 429/5xx/Timeouts | Produktionsnamespace, echte API-Tokens |
| `CP-TD-007` | PublicTagView | Public-API-Contract | frei erfundene öffentliche Titel, Texte, Testbild- und Link-URLs | Entwürfe, Ownerdaten, Upload-Keys, Auditdaten |
| `CP-TD-008` | Policies/Organisation | Produkt-/Mandantengrenzen | synthetische Tarife, Organisationen, Rollen und Laufzeiten | reale Firmen, Kontakte, Zahlungen |
| `CP-TD-009` | POI-Review | Pflichtgates und Nachweiszugriff | fiktive Orte, redigierter Platzhalternachweis, Testmeldungen | Standortfreigaben, Ausweise, Betreiberkontakte |
| `CP-TD-010` | Audit/Observability | Redaction und Korrelation | künstliche IDs, Aktionen und redigierte Metadaten | Tokens, Passwörter, PINs, vollständige Nachweise |
| `CP-TD-011` | Claiming | Credential-, Lockout- und Parallelclaimprüfung | isolierte künstliche PINs/Passwörter ausschließlich im Test-Secret-Store, Claim-Gruppen, Fehlversuchszähler | Klartext-Credentials in Fixtures, Logs, Audit oder Evidence |
| `CP-TD-012` | Allocation Pool / Preassign | Pool-, Kundenkontext- und Self-Print-Prüfung | synthetische Pools, Organisationen, Owner-Referenzen und zeitlich begrenzte Testexporte | reale Kunden, Ownerdaten, Serien oder Drucklisten |

Für Beispielhosts sind `.invalid`-Domains zu verwenden. Ein bestätigter öffentlicher Staging-Host wird nur in geschützter Laufzeitkonfiguration geführt.

## 3. Kernfixtures

### 3.1 Range und Allocation (`CP-TD-001`, `CP-TD-002`)

| Fall | Zweck | Erwartung |
| --- | --- | --- |
| gültige 6-stellige Test-Range | positiver Range-Fall | kanonisch, aktiv, nicht überlappend |
| überlappende Test-Range | Negativfall | Speicherung/Projektion abgelehnt |
| gültige 8-stellige 16er-Slot-Range | HMAC-Slotregel | akzeptiert |
| 8-stellige Range mit fehlerhafter Start-/Endgrenze | HMAC-Slotregel | abgelehnt |
| parallele Reservierungen | DB-Parallelität | einzigartige TAGs ohne Doppelvergabe |
| Wiederholung mit gleicher Korrelation | Idempotenz | keine zweite Reservierung |

Konkrete Zahlenwerte entstehen erst bei Implementierung auf Basis des kanonischen Raums und isolierter Testvektoren. Sie dürfen keine Produktionsrange oder echte Secret-Ausgabe nachbilden.

### 3.2 Allocation Pools und Claiming (`CP-TD-011`, `CP-TD-012`)

Ein Pool-Fixture repräsentiert ausschließlich einen synthetischen Pool im kanonischen `decodedValue`-Raum, etwa `private-retail-test`, `partner-test` oder `enterprise-test`. Es enthält Poolstatus, zulässige Claim-/Produktpolicy, Kapazitätsgrenzen und optional eine künstliche Organisationsreferenz, jedoch keine echten Kundendaten.

Claim-Fixtures dürfen Klartext-PINs oder -Passwörter ausschließlich im isolierten lokalen/CI-Secret-Provider führen. Versionierte Fixture-Dateien enthalten nur eine nicht rückrechenbare Testreferenz, den erwarteten Hash-Algorithmus sowie künstliche Fehlversuchs-, Lockout- und Besitzstatus. Bogen-/Chargen-PIN-Tests erzeugen für jeden zugehörigen Test-TAG einen eigenständigen Hashdatensatz.

### 3.3 Produktionslos und Drucksnapshot (`CP-TD-004`)

Ein Testproduktionslos enthält nur:

- eine eindeutig als Test gekennzeichnete Produktklasse;
- Staging- oder lokale Umgebung;
- eine synthetische Druckvorlagen-ID samt Version;
- mehrere autoritativ reservierte Test-TAGs;
- fortlaufende Positionsnummern;
- kanonische Scan-URLs auf `.invalid` oder geschützte Staging-Konfiguration;
- erfundene QA-Ergebnisse, Fehlergründe und Übergabereferenzen.

Ein regulärer Snapshot darf ausschließlich die für Herstellung nötigen öffentlichen Daten enthalten: TAG-ID, kanonische Scan-URL, QR-Payload, Vorlagen-/Positionsinformationen sowie Prüfsummenmetadaten. Er darf keine Secrets, Ownerdaten, Cloudflare-Token, internen Admin-URLs oder Vault-Inhalte enthalten.

Ein gesonderter, vertraulicher Claim-/Self-Print-Export darf zusätzlich nur den zum Druck erforderlichen künstlichen Test-Credentialwert enthalten. Er ist nicht versioniert, zeitlich begrenzt, zugriffsgeschützt und wird nie als Test-Evidenz, KV-Dokument, API-Response, Auditmetadatum oder Log übernommen.

### 3.4 Routing-Projektion (`CP-TD-005`)

Eine positive Fixture enthält ausschließlich:

- einen `tag-range-index`;
- mindestens eine zulässige Gruppe;
- Range- oder direkte TAG-Regel;
- ein validiertes Feature, beispielsweise `tag-vault`;
- eine sichere Test-URL wie `https://tag-app.example.invalid/tag/{tagId}`.

Negativfixtures enthalten gezielt überlappende Ranges, unbekannte Features, fehlende Referenzen, unzulässige Identifier/URLs und ausgeschlossene Felder wie `ownerEmail`, `productionLot`, `auditTrail`, `verificationDocument`, `apiToken` oder `vaultContent`.

### 3.5 Öffentlicher Basis-Vault (`CP-TD-007`)

Der finale PublicTagView-Vertrag wird vor `CP-I05` mit der TAG-App versioniert. Eine zulässige Fixture enthält nur ausdrücklich öffentliche und veröffentlichte Felder, beispielsweise:

```json
{
  "tagId": "example-tag-id",
  "status": "available",
  "vault": {
    "title": "Synthetischer TAG",
    "description": "Öffentlicher Testinhalt ohne personenbezogene Daten.",
    "imageUrl": "https://media.example.invalid/public/example.jpg",
    "externalLink": {
      "label": "Beispielinformation",
      "url": "https://www.example.invalid/"
    }
  }
}
```

Verboten sind insbesondere `ownerId`, `organizationId`, `productionLotId`, Druck-/QA-Status, interne Sperrgründe, Produktpolicy, Auditdaten, Quoten, Sessions, Admin-Links, Nachweise, Upload-Keys und Entwurfsfelder.

## 4. Secret- und Konfigurationsklassen

| Klasse | Speicherort | Einsatz |
| --- | --- | --- |
| Nicht geheime Beispielkonfiguration | versioniertes Template ohne Werte | lokale Schema-/Validierungstests |
| Testsecrets | lokaler/CI-Secret-Store | kryptografische Testvektoren, Auth-/Adaptertests |
| Staging-Secrets | geschützter Staging-Secret-Store | echter kontrollierter Staging-Publish und Scan |
| Produktionssecrets | getrennt geschützter Produktions-Secret-Store | ausschließlich Betrieb |
| Cloudflare-Token | umgebungsspezifischer Secret-Store, least privilege | nur Publisher der passenden Umgebung |

Fehlt ein Secret oder passt ein Umgebungsmarker nicht, muss der betroffene Control-Plane-Prozess fail-closed abbrechen und darf nicht auf Default-, Browser- oder fremde Umgebungswerte zurückfallen.

## 5. Bereinigung und Evidenz

- DB-Tests verwenden Transaktionsrollback oder isolierte Testdatenbanken.
- Drucksnapshot- und Publisher-Sandboxdaten werden nach Tests zurückgesetzt.
- Staging-Evidenz redigiert Token, Cookies, sensible Header, private IDs und personenbezogene Angaben.
- Vor Commit und Deployment werden Fixtures, Logs und Evidence-Artefakte auf Secretmuster geprüft.
