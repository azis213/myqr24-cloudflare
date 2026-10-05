# Berechtigungs-, Datenschutz- und Capability-Modell der myQR24-PWA

> **Status:** Architekturentscheidung  
> **Stand:** 2026-10-02  
> **Geltungsbereich:** Gemeinsame myQR24-PWA für öffentliche TAG-Ansichten, persönliche Funktionen und Owner-Verwaltung.  
> **Ergänzt:** [Cloudflare-native PWA-Komponente](CLOUDFLARE_PWA_COMPONENT.md), [TAG-Typen und POI-Features](../20-Special-Specifications/TAG_TYPES_AND_POI_FEATURES.md)

## 1. Entscheidung

myQR24 wird langfristig als **eine gemeinsame PWA** betrieben. Sie vereint:

- öffentliche, ohne Anmeldung erreichbare TAG-Inhalte;
- integrierten QR-/NFC-Scan, soweit Browser und Gerät dies unterstützen;
- persönliche Scan-Historie, Collections und Campaigns;
- Owner-, Betreiber- und Moderatoroberflächen.

Der Edge Router bleibt hiervon strikt getrennt. Er validiert externe öffentliche Scan-URLs und leitet auf die gemeinsame PWA weiter. Die Application API bleibt die einzige Autorität für Sichtbarkeit, Rollen, Zustände, Berechtigungen und fachliche Aktionen.

```text
externer NFC-/QR-Scan → Edge Router → /tag/{tagId}
integrierter App-Scan → lokale URL-Erkennung → /tag/{tagId}
                                      ↓
                            Application API:
                    View + serverseitige Capabilities
```

Die PWA darf bekannte myQR24-Scan-URL-Schemata für eine schnelle interne Navigation erkennen. Sie prüft jedoch weder Feistel/HMAC noch Routing-KV oder Redirect-Signaturen und entscheidet nie selbst über fachliche Zulässigkeit.

## 2. Datenschutzprinzipien

1. **Öffentliche Inhalte zuerst:** Lesen eines öffentlichen TAG-Views erfordert weder Konto noch Browserberechtigung.
2. **Kontext statt Startdialog:** Kamera, Standort, Mikrofon, Benachrichtigungen oder Speicherung werden nur nach einer konkreten Nutzeraktion angefragt.
3. **Datensparsame Standardwerte:** Personalisierte Historie, präziser Standort, Offline-Standortqueue, Push und Partnerweitergabe sind standardmäßig deaktiviert.
4. **Sinnvolle Degradierung:** Verweigerung schränkt nur die abhängige Funktion ein; sie blockiert nicht die öffentliche TAG-Ansicht.
5. **Transparente Trennung:** Systemberechtigung, myQR24-Präferenz und serverseitige Einwilligung sind unterschiedliche Zustände.
6. **Serverautorität:** Die API liefert erlaubte Aktionen und prüft jeden schreibenden oder geschützten Request erneut.
7. **Widerruf:** Präferenzen und Einwilligungen sind in der App widerrufbar; Systemberechtigungen werden im Browser oder Betriebssystem verwaltet.
8. **Keine stillen Standortprofile:** Standort wird nicht beim Öffnen, Scannen oder Rendern eines TAGs erhoben.

## 3. Drei Ebenen der Berechtigung

| Ebene | Beispiele | Autorität | Grenze |
| --- | --- | --- | --- |
| Systemberechtigung | Kamera, Standort, Mikrofon, Push | Browser / Betriebssystem | Die PWA kann sie nur auf Nutzeraktion anfragen, nicht selbst dauerhaft erzwingen oder widerrufen. |
| myQR24-Präferenz | lokale Scan-Historie, Kamera-Scanner bevorzugen, Standort für Check-ins verwenden | PWA + ggf. synchronisierte Kontoeinstellung | Steuert die Verwendung einer bereits verfügbaren Systemberechtigung. |
| Einwilligung / Policy | Standort für Check-in speichern, Campaign-Credit, Beitrag/Upload, Owner-Aktion | Application API | Dokumentiert Zweck und Kontext; ersetzt keine Systemberechtigung. |

Ein App-Switch darf deshalb nie „Kamera erlaubt“ oder „Standort erlaubt“ behaupten. Er beschreibt korrekt die beabsichtigte myQR24-Verwendung, beispielsweise: „Standort für bewusst gestartete Check-ins verwenden“.

## 4. Berechtigungszentrum

Die gemeinsame PWA erhält eine persönliche Route:

```text
/me/privacy-and-permissions
```

Sie ist ohne angemeldetes Konto eingeschränkt verfügbar und zeigt lokale Präferenzen; mit Konto zeigt sie zusätzlich synchronisierte Präferenzen und gespeicherte Einwilligungen.

### 4.1 Inhalte

| Bereich | Anzeige und Steuerung |
| --- | --- |
| Kamera | Systemstatus, integrierten Scanner aktivieren/deaktivieren, manuellen Eingabefallback erklären |
| Standort | Systemstatus, Verwendung für Check-ins, optionale Offline-Queue, Campaign-Anforderungen |
| Scans | lokale temporäre Historie, Konto-Synchronisierung, Löschen und Übernahme lokaler Einträge |
| Kommunikation | Besucher-Thread, Guestbook-Beiträge, Upload-/Mikrofon-Hinweise |
| Benachrichtigungen | Systemstatus und produktseitige Kategorien, standardmäßig deaktiviert |
| Datenverarbeitung | Zweck, Speicherort, Retention, Widerruf und Link zu Datenschutzinformationen |

Die PWA versucht nicht, fehlende Systemrechte selbst zu ändern. Sie erklärt den Zustand und verlinkt, soweit Browser/Plattform dies erlauben, auf die passenden Einstellungen.

### 4.2 Kontextdialoge

Vor einem Systemdialog zeigt myQR24 bei komplexeren Fällen einen kurzen eigenen Kontextdialog:

| Nutzerentscheidung | Wirkung |
| --- | --- |
| **Jetzt verwenden** | führt die konkrete Aktion aus und löst erst dann gegebenenfalls den Systemdialog aus |
| **Für diese Funktion merken** | speichert eine myQR24-Präferenz; die tatsächliche Systemfreigabe bleibt Browser-/OS-abhängig |
| **Ohne diese Funktion fortfahren** | verwendet einen zulässigen Fallback und fragt im selben Ablauf nicht erneut |
| **Einstellungen verwalten** | öffnet das Berechtigungszentrum |

Die Formulierung „immer erlauben“ wird nicht verwendet, sofern Browser oder Betriebssystem dies nicht verlässlich zusichern. Die UI erklärt stattdessen, dass dauerhaft erteilte Systemrechte jederzeit außerhalb von myQR24 widerrufen werden können.

## 5. Scan- und Navigationsmodell

Die Hauptnavigation der installierbaren App folgt dem Nutzerziel:

```text
Start | Scannen | Meine Inhalte | Konto
```

Ein Scan erzeugt einen vorrangigen, aber temporären TAG-Kontext:

```text
Scannen
→ /tag/{tagId}
→ öffentliche Inhalte zuerst
→ passende optionale Aktionen
→ Zurück: vorheriger Kontext oder Scanner
```

Die TAG-Seite kann nach serverseitigem API-Resultat kontextbezogene Aktionen ergänzen:

```text
Besuch sammeln
Zu meinen Scans hinzufügen
Lost & Found kontaktieren
Dieses TAG claimen
Dieses TAG verwalten
```

Die Reihenfolge lautet:

1. öffentliche Inhalte;
2. freigegebene öffentliche Feature-Einstiege;
3. persönliche Aktionen für die aktuelle Session;
4. Owner-/Betreiberaktionen nur bei bestätigter Serverberechtigung.

## 6. Capabilities statt Client-Autorisierung

Die Application API liefert zusammen mit einem öffentlichen View nur darstellbare, sessionspezifische Aktionen. Beispiel:

```ts
type TagCapabilities = {
  canSaveScan: boolean;
  canClaim: boolean;
  canManageAsOwner: boolean;
  canStartLostFoundContact: boolean;
  canPostGuestbookEntry: boolean;
  canStartCheckIn: boolean;
  checkInRequirement?: "account" | "scan-only" | "geo-proximity" | "online-challenge";
  canEarnCampaignCredit: boolean;
};
```

Capabilities sind ein UX-Vertrag, keine Berechtigungserteilung. Jeder geschützte API-Request prüft erneut:

- Session, Rolle und TAG-Zuordnung;
- Produktklasse und Feature-Status;
- Sichtbarkeits-, Zeitfenster- und Moderationspolicy;
- Einwilligungs-/Zweckkontext, sofern erforderlich;
- GEO-, Campaign- und Rate-Limit-Regeln.

Der Client darf weder Owner-Status noch Campaign-Eligibility aus TAG-ID, lokaler Historie, gespeicherten Feature-Flags oder eingeblendeten Buttons ableiten.

## 7. Fallback-Matrix nach Feature

| Funktion | Mindestvoraussetzung | Bei Verweigerung / Nichtverfügbarkeit |
| --- | --- | --- |
| Öffentlicher Vault | keine | öffentliche Inhalte bleiben nutzbar |
| App-Kamera-Scan | bewusster Klick, Kamera-Systemrecht | TAG-ID manuell eingeben oder URL öffnen |
| NFC-Scan | Nutzeraktion, Browser-/Geräteunterstützung | QR-Scan oder manuelle Eingabe |
| Lokale Scan-Historie | App-Präferenz | keine lokale Historie |
| Kontoübergreifende Scan-Sammlung | Anmeldung + serverseitige Capability | kein persistentes Sammeln |
| Lost & Found / Chat | Feature + Session/Abuse-Policy | öffentliche Ansicht bleibt; Kontakt nicht verfügbar |
| Guestbook-Text | offenes Feature, Policy, ggf. Turnstile | Lesen bleibt möglich; kein Beitrag |
| Bild-/Voice-Beitrag | Upload-/Mikrofonrecht + Feature-Policy | Textbeitrag, falls erlaubt; sonst keine Einreichung |
| `scan-only`-Check-in | Konto, wenn persönlich gespeichert | Inhalte sichtbar, kein Collection-/Campaign-Credit |
| `geo-proximity`-Check-in | Konto + bewusste Standortfreigabe | kein qualifizierter Check-in; keine verdeckte Ortung |
| Campaign / Reward | Konto + Campaign-Policy, ggf. Online-/GEO-Prüfung | Fortschritt/Reward nicht verfügbar |
| Owner-Verwaltung | Owner-Session, bei sensiblen Vorgängen starke Authentisierung | öffentliche TAG-Seite bleibt sichtbar, Verwaltung gesperrt |

## 8. Produktklassen und Defaults

| Produktklasse | Öffentlicher Scan/View | persönliche Speicherung | Standort / Check-in | Besonderheit |
| --- | --- | --- | --- | --- |
| Anonymes Demo-TAG | ohne Konto | keine personenbezogene Serverhistorie | nicht verfügbar | keine Uploads |
| Selbstprint-TAG | ohne Konto | optional nach Anmeldung | standardmäßig nicht verfügbar | begrenzter Lost-&-Found-Flow |
| Physisches Standard-TAG | ohne Konto | optional nach Anmeldung | nur bei aktivem Check-in-Feature | Owner per Server-Session |
| Premium-/Content-TAG | gemäß Sichtbarkeit | optional nach Anmeldung | nur zweckgebunden | private Daten nie persistent im Browser |
| POI-/Community-TAG | ohne Konto | optional nach Anmeldung | nur bewusster Check-in | öffentlicher Content ohne GPS |
| Partner-/Serien-TAG | gemäß dokumentierter Policy | optional nach Anmeldung | nur dokumentierte Campaign-Policy | keine stille Partnerdatenweitergabe |

Insbesondere für POIs gilt: Öffentliche Informationen, Sicherheits- und Ortsinhalte müssen ohne Anmeldung und ohne Standortfreigabe verfügbar bleiben. Ein Check-in ist eine optionale persönliche Aktion.

## 9. Standort und Check-in

Standort darf ausschließlich nach der Aktion **„Check-in mit Standort bestätigen“** abgefragt werden. Vor der Systemanfrage zeigt die App:

- für welches TAG und welchen Zweck die Position benötigt wird;
- ob nur geprüft oder zusätzlich bis zur Synchronisation lokal vorgemerkt wird;
- dass die API Distanz, Genauigkeit, Zeit, Session und GeoFence serverseitig entscheidet;
- dass ein verweigerter Standort keinen öffentlichen Content sperrt.

Für Check-ins gelten zusätzlich:

- Rohkoordinaten erscheinen nie in öffentlichem Vault, Guestbook, Collection oder Campaign-Antworten.
- Cache Storage speichert keine Standorte, Check-in-Views oder Sessions.
- Eine Offline-Queue ist auf `pending-sync` begrenzt, zeitlich limitiert und nur nach erklärter Nutzerentscheidung aktiv.
- Reward-relevante Aktionen können eine Online-Prüfung erfordern und dürfen nicht allein auf lokalem GPS beruhen.
- Der Widerruf einer Standortpräferenz verhindert neue Erfassungen; bereits angenommene Ereignisse folgen ihrer dokumentierten Retention- und Löschpolicy.

## 10. Datenminimierung, Speicherung und Audit

Für Zustimmungen wird nur der notwendige Nachweis gespeichert:

```text
accountId (falls vorhanden)
purpose
scope: global | feature | tag | campaign
decision: enabled | declined | revoked
policyVersion
recordedAt
reviewAt / expiresAt (falls erforderlich)
```

Nicht als Einwilligungsnachweis speichern:

- Rohstandorte, sofern nicht für einen konkreten Check-in notwendig;
- vollständige Browser-Fingerprints;
- Systemberechtigungs- oder Geräteinformationen über das erforderliche Minimum hinaus;
- private Inhalte, Session-Tokens oder Message-Texte.

Sicherheitsrelevante Änderungen und Einwilligungswiderrufe sind auditierbar. Audit-Daten enthalten keine Secrets und keine vermeidbaren Inhaltskopien.

## 11. Plattformgrenzen

- Eine PWA kann Kamera und Standort nicht ohne Systemzustimmung nutzen.
- Ein externes NFC-/QR-Scanning öffnet nicht auf allen Plattformen verlässlich eine installierte PWA statt des Browsers.
- Web NFC ist nicht auf allen Zielplattformen verfügbar, insbesondere nicht als vollständiger iOS-Pfad.
- Android App Links und iOS Universal Links benötigen eine native App oder Hülle, wenn ein garantierter app-nativer Einstieg ohne Browserfluss Produktanforderung wird.
- Eine spätere native Hülle kann dieselbe PWA-Oberfläche und dieselbe Application API verwenden; sie ersetzt nicht deren serverseitige Autorisierung.

## 12. Verbindliche Regeln

1. Kein Systemberechtigungsdialog beim App-Start oder beim bloßen Öffnen einer öffentlichen TAG-Seite.
2. Jede Berechtigungsanfrage folgt aus einer klaren Nutzeraktion und benennt ihren Zweck.
3. Verweigerung darf öffentliche Inhalte nie ohne fachlichen Grund blockieren.
4. Systemberechtigung, App-Präferenz und API-Policy sind getrennt modelliert und verständlich dargestellt.
5. Die API liefert Capabilities und prüft jede geschützte Aktion erneut serverseitig.
6. Präziser Standort wird nicht als Scan-Nebenwirkung erhoben oder veröffentlicht.
7. Produktklassen und Feature-Policy begrenzen, welche personenbezogenen Funktionen überhaupt angeboten werden.
8. Private Daten, Sessions, Check-ins, Chat und geschützte Medien werden nicht persistent im Service-Worker-Cache gespeichert.
9. Neue TAG-Typen oder Features müssen ihre Berechtigungsanforderungen, Fallbacks, Retention und Tests vor Implementierung festlegen.
