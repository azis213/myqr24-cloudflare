# Testdaten und Fixtures: TAG Control Center

**Planungsstand:** 2026-10-06  
**Status:** Planung; dieses Dokument legt Regeln fest, erzeugt jedoch keine Datenbank, keine Secrets und keine produktive Konfiguration.

## 1. Grundregeln

1. Testdaten sind synthetisch, reproduzierbar und eindeutig als Test/Staging markiert.
2. Produktionsdaten, echte Personen, reale Betreiberkontakte, echte Standortnachweise, Zugangsdaten und Secrets dürfen weder in Fixtures noch in Screenshots/Evidenz erscheinen.
3. Feistel- und HMAC-Secretwerte werden niemals als Fixture geführt. Tests verwenden einen isolierten Test-Secret-Provider oder vordefinierte, nicht produktive Testvektoren außerhalb von Versionskontrolle, soweit erforderlich.
4. Cloudflare-Tokens, echte Account-/Namespace-IDs, Datenbankzugänge und Mail-/MFA-Credentials gehören ausschließlich in den Secret-Store der jeweiligen Umgebung.
5. Jede Fixture muss ihre Datenklassifikation (öffentlich, intern-synthetisch, secret-external) erkennen lassen.
6. Staging und Produktion teilen niemals dieselben Testdaten, Tokens, Namespace-IDs oder Datenbankverbindungen.

## 2. Vorgesehene Fixture-Klassen

| ID | Klasse | Zweck | Zulässiger Inhalt | Nicht zulässig |
| --- | --- | --- | --- | --- |
| `CC-TD-001` | Admin/Rollen | AuthZ-Matrix und Audit | synthetische Konten wie `admin@example.invalid`, Rollen, deaktivierte Konten | echte E-Mail-Adressen, Passwörter, MFA-Secrets |
| `CC-TD-002` | TAG-Range | Range-Validierung | kleine kanonische 6-/8-stellige Testbereiche, Gruppen-IDs | Produktionsranges, echte Secret-Derivate |
| `CC-TD-003` | TAG-Allocator | Vergabe, Parallelität und Retry | deterministische Startwerte, reservierte Test-TAGs, Test-Korrelationen | Produktions-TAGs oder echte Ausgabeaufträge |
| `CC-TD-004` | Routing-Projektion | KV-Schema und Edge-Contract | minimale Gruppen, Regeln, sichere HTTPS-Testziele, Feature-Dokumente | Owner-/Kontaktdaten, Vault-Inhalte, Token, Nachweise |
| `CC-TD-005` | Publisher-Sandbox | Publish/Unpublish/Retry | Fake-Cloudflare-Client, isolierte Staging-Referenzen, simulierte Fehler | Produktionsnamespace, Produktions-API-Token |
| `CC-TD-006` | Öffentlicher Basis-Vault | `PublicTagView`-Contract | frei erfundene Titel, Texte, Bild-URL auf Testhost, erlaubte externe Link-URL | private Texte, Uploads, PINs, echte Medien |
| `CC-TD-007` | API-Sicherheit | CORS, Cache, Rate Limits und negative Antworten | erlaubte/nicht erlaubte `.invalid`-Origins, unbekannte Test-TAGs | echte Endnutzer-Identifier oder IP-Adressen |
| `CC-TD-008` | Produkt/Organisation | Produktpolicy und Mandantengrenzen | synthetische Organisationen, Rollen, Tarife, Laufzeiten | reale Firmen-, Kontakt- oder Zahlungsdaten |
| `CC-TD-009` | POI-Review | Prüfung, Moderation und Meldungen | fiktiver Standort, redigierter Platzhalternachweis, Testmeldung | echte Standortfreigaben, Ausweisdokumente, Kontaktpersonen |
| `CC-TD-010` | Audit/Observability | Audit- und Log-Sanitizing | künstliche Aktionen, redigierte Metadaten, Korrelations-IDs | Secrets, vollwertige Sessiontokens, personenbezogene Klartexte |
| `CC-TD-011` | Pool-/Claim-UX | Poolverwaltung, Claim-Strategie, Preassign und vertraulicher Export | synthetische Pool-/Policy-/Kapazitätszustände, maskierte Exportmetadaten, künstliche Audit-Referenzen | Credentials, Credential-Hashes, Klartext-PINs, reale Owner-/Bestelldaten |

`.invalid`-Domains sind für nicht auflösbare Beispielhosts zu bevorzugen. Für öffentliche Staging-Tests wird der bestätigte Staging-Host ausschließlich in geschützter Laufzeitkonfiguration verwendet, nicht als allgemein wiederverwendbare Fixture.

## 3. Mindestdaten für zentrale Tests

### 3.1 Rollenmatrix (`CC-TD-001`)

| Subjekt | Rolle | Erwartete Berechtigung |
| --- | --- | --- |
| `cc-admin@example.invalid` | `platform-admin` | Rollen, Produktpolicies, Sperren und Publishing innerhalb der Freigaberegeln |
| `cc-tag-manager@example.invalid` | `tag-manager` | Entwurf, Vergabe, Routing-Diff und beantragtes Publishing |
| `cc-editor@example.invalid` | `content-editor` | Basis-Vault-Entwurf, keine Routing-/Rollenänderung |
| `cc-reviewer@example.invalid` | `reviewer` | POI-Review, keine globale Konfigurationsänderung |
| `cc-org-admin@example.invalid` | `organization-admin` | Mitglieder im eigenen Organisationskontext |
| `cc-unauthorized@example.invalid` | keine Rolle | keine Verwaltungsoperation |
| `cc-suspended@example.invalid` | gesperrt | keine Sitzung bzw. keine Mutation |

Passwort-Hashwerte werden nur testlokal generiert oder als eindeutig nicht produktive, dokumentierte Testhashes in einem sicher geeigneten Testmechanismus geführt. Klartextpasswörter gehören nicht in dieses Dokument oder allgemeine Fixtures.

### 3.2 Range- und Allocator-Fälle (`CC-TD-002`, `CC-TD-003`)

| Fall | Zweck | Erwartung |
| --- | --- | --- |
| gültige 6-stellige Test-Range | positive Range-Prüfung | Range ist kanonisch und nicht überlappend |
| überlappende 6-stellige Test-Range | negative Validierung | Speicherung/Publish wird verweigert |
| gültige 8-stellige Range mit vollständigen 16er-Slots | Slotregel | akzeptiert |
| 8-stellige Range mit `start % 16 != 0` | Slotregel | abgewiesen |
| 8-stellige Range mit `end % 16 != 15` | Slotregel | abgewiesen |
| parallele Reservierung auf gleicher Range | Konkurrenztest | einzigartige IDs ohne Lückenannahme |
| Retry mit gleicher Idempotenz-/Korrelation-ID | Wiederholung | kein zweiter fachlicher Vergabevorgang |

Konkrete numerische Testwerte werden erst zusammen mit der Implementierung aus dem gültigen kanonischen Raum und den freigegebenen Testvektoren abgeleitet. Sie dürfen keine reale Produktionskonfiguration nachbilden.

### 3.3 Pool-, Claim- und Vorabzuweisungsansicht (`CC-TD-011`)

Eine UI-Fixture enthält nur synthetische, nicht geheime Contract-Daten, beispielsweise Poolkennung, Zielgruppe/Ausgabekanal, `decodedValue`-Range-Referenz, Kapazitätsampel, zulässige Claim-Strategien, Credential-Typ, Verteilungsmodell, Lockout-Policy-Bezeichnung, Druckstatus sowie eine künstliche Audit-Referenz.

Eine vertrauliche Exportansicht enthält lediglich Zweck, Umfang, Ablaufzeit, erneute Freigabeanforderung und eine maskierte Downloadreferenz. Sie enthält nie den Credentialwert, Credential-Hash, Fehlversuchszähler, Ownerdaten oder eine persistierbare Download-URL. Test-Credentials existieren nur im isolierten Control-Plane-Test-Secret-Provider und werden weder vom Browser noch von versionierten UI-Fixtures abgerufen.

### 3.4 Minimale Projektion (`CC-TD-004`)

Eine gültige Testprojektion enthält ausschließlich:

- einen `tag-range-index`;
- mindestens eine Gruppe;
- eine Range-Regel;
- bei Bedarf eine direkte TAG-Regel;
- mindestens ein typspezifisch gültiges Feature, zum Beispiel `tag-vault`;
- ausschließlich sichere Testziele wie `https://tag-app.example.invalid/tag/{tagId}`.

Explizite Negativfixtures enthalten mindestens:

- überlappende oder unsortierte Ranges;
- nicht vorhandene Gruppen oder Features;
- unbekannte Featuretypen;
- nicht kanonische oder unzulässige Identifier;
- private Felder wie `ownerEmail`, `auditTrail`, `verificationDocument`, `apiToken` oder `vaultContent`;
- unsichere bzw. nicht erlaubte URLs.

## 4. PublicTagView-Contract-Fixture (`CC-TD-006`)

Der genaue Vertrag wird vor `CC-I04` mit dem TAG-App-Strang versioniert. Eine Fixture darf nur Felder enthalten, die öffentlich und veröffentlicht sein sollen, beispielsweise:

```json
{
  "tagId": "example-tag-id",
  "status": "available",
  "vault": {
    "title": "Beispielinhalt",
    "description": "Synthetischer öffentlicher Testinhalt.",
    "imageUrl": "https://media.example.invalid/public/example.jpg",
    "externalLink": {
      "label": "Beispiellink",
      "url": "https://www.example.invalid/"
    }
  }
}
```

Nicht zulässig sind insbesondere `ownerId`, `organizationId`, interne Statusgründe, Produktpolicy, Auditdaten, Quoten, Sessiondaten, Admin-Links, Upload-Keys, Nachweise und Entwurfsfelder.

## 5. Secret- und Konfigurationsklassen

| Klasse | Speicherort | Verwendung in Tests |
| --- | --- | --- |
| Nicht geheime Konfiguration | versionierte Beispielkonfiguration ohne Werte oder CI-Variablen | Schema-/Validierungstests |
| Testsecrets | isolierter lokaler/CI-Secret-Store | kryptografische Testvektoren, Auth-Integration |
| Staging-Secrets | geschützter Staging-Secret-Store | kontrollierte echte Staging-Publishes |
| Produktionssecrets | Produktions-Secret-Store | ausschließlich Produktion; nie Testlauf |
| Cloudflare-Token | umgebungsspezifischer Secret-Store, least privilege | nur Publisher-Integration der passenden Umgebung |

Fehlt ein erforderliches Secret, muss der betroffene Prozess fail-closed abbrechen. Er darf nicht auf einen Defaultwert, ein Staging-Secret oder eine Browservariable zurückfallen.

## 6. Bereinigung und Evidenz

- Datenbank-Testläufe verwenden transaktionales Rollback oder isolierte, nach dem Lauf gelöschte Datenbanken.
- Publisher-Sandboxdaten werden nach dem Testlauf zurückgesetzt.
- Staging-Evidenz redigiert Tokens, Cookie-Werte, Header mit Credentials, vollständige interne IDs und personenbezogene Daten.
- Vor Commits und vor Deployment werden Fixture-, Log- und Evidence-Dateien auf Secretmuster geprüft.
