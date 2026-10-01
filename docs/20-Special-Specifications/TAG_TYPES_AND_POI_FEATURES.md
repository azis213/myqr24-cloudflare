# TAG-Typen und POI-/Community-TAGs – Produktmodell, Funktionen und Schutzregeln

> **Status:** Fachliche Spezifikation / Architekturvorschlag  
> **Zweck:** Definition der myQR24-TAG-Produktarten, insbesondere für selbstgedruckte TAGs und autorisierte POI-/Community-TAGs an Gipfelkreuzen, Berghütten, Museen, touristischen Orten und anderen interessanten Standorten.

---

## 1. Zielbild

myQR24 soll nicht nur als kostenpflichtiges physisches TAG-Produkt wachsen. Kostenfreie, selbstgedruckte und von Partnern betriebene TAGs dienen bewusst als Akquisitions- und Verbreitungskanal.

Dabei gelten zwei gleichwertige Ziele:

1. **Niedrige Einstiegshürde und Sichtbarkeit**
   - private Nutzer sollen myQR24 mit selbstgedruckten QR-TAGs ausprobieren können;
   - interessante öffentliche Orte sollen die Plattform sichtbar und nachvollziehbar machen;
   - ein Scan soll für Besucher einen unmittelbaren Nutzen haben.

2. **Sicheres und wirtschaftlich begrenztes Produkt**
   - Free-TAGs dürfen kein unbegrenztes kostenloses Medienhosting werden;
   - öffentliche POIs benötigen eine verantwortliche Betreiberperson oder Organisation;
   - Missbrauch, unzulässige Anbringung und unmoderierte Inhalte müssen begrenzt werden;
   - Speicher-, Traffic-, Sicherheits- und Moderationskosten werden nach Produktklasse gesteuert.

Ein POI-TAG ist kein neuer Edge-Routing-Feature-Typ. Es ist eine **autorisierte TAG-Produktklasse** mit einem klaren Betreiber, einem öffentlichen Vault-Präsentationsprofil und optionalen bestehenden Features:

```text
POI-/Community-TAG
  ├─ tag-vault
  │   └─ öffentliche POI-Seite, Bilder, Audio, Hinweise, Links
  ├─ optional tag-checkin
  │   └─ Sammlung, Gipfel-/Hüttenpass, GEO-verifizierter Besuch
  └─ optional tag-guestbook
      └─ moderiertes digitales Gipfelbuch oder Besucherbuch
```

Der Edge Tag Router bleibt unabhängig davon ausschließlich für die sichere öffentliche Tag-Auflösung verantwortlich.

---

## 2. TAG-Produktklassen

| Produktklasse | Zielgruppe und Zweck | Vorgeschlagene Laufzeit | Kernfunktionen | Kosten- und Schutzgrenze |
| --- | --- | --- | --- | --- |
| **Anonymes Demo-TAG** | spontanes Kennenlernen ohne Konto | 30 Tage | minimaler Text, Link oder einfache öffentliche Ansicht | kein Upload; starkes Rate Limit; nach Ablauf nicht reaktivierbar ohne Konto |
| **Selbstprint-TAG** | private QR-/NFC-Nutzung auf selbst erzeugten TAGs | 6 Monate, optional bis 12 Monate | öffentliche TAG-Seite, begrenztes Lost & Found, begrenzte Links und wenige Bilder | maximal 3 aktive TAGs je verifiziertem Konto; kleines Speicher- und Abrufkontingent |
| **Physisches Standard-TAG** | Koffer, Schlüssel, Fahrrad, Haustier, persönliche Gegenstände | bis zu 5 Jahre nach Produktregel | Lost & Found, stabile öffentliche Seite, definierter Basis-Vault | einmaliger Kaufpreis, z. B. 5 EUR; begrenzter Basis-Content |
| **Premium-/Content-TAG** | contentreiche private oder kommerzielle Nutzung | tarifabhängig | größerer Vault, private Freigaben, weitere Medien, zusätzliche Funktionen | Speicher-, Abruf- und ggf. Jahres-/Zusatzentgelt |
| **POI-/Community-TAG** | autorisierte Orte, Hütten, Gipfel, Museen, Vereine, Tourismus | 12 Monate, verlängerbar | öffentliche POI-Seite; optional Check-in und moderiertes Besucherbuch | bestätigter Betreiber, dokumentierte Anbringungszustimmung, kuratiertes Feature-Set |
| **Partner-/Serien-TAG** | Organisationen, Vertrieb, Kampagnen, Verwaltungen | vertraglich oder kampagnenbezogen | Bulk-Verwaltung, Organisation, ggf. Kampagnen/Collections | eigene Rollen, Kontingente, Support- und Abrechnungsmodell |

Die genannten Laufzeiten und Kontingente sind Produktdefaults. Sie müssen zentral konfigurierbar sein; der Edge Router enthält keine Tarif- oder Kontostatusentscheidungen.

---

## 3. Produktstrategie für kostenfreie TAGs

### 3.1 Anonymes Demo-TAG

Ein 30-Tage-Zeitraum ist sinnvoll, wenn kein Konto angelegt wird. Das Demo-TAG erlaubt einen unmittelbaren Produkttest, ohne dass es als dauerhaftes Gratisangebot missverstanden wird.

```text
Kein Konto
  → ein zeitlich begrenztes Demo-TAG
  → 30 Tage
  → minimaler öffentlicher Inhalt
  → keine privaten Funktionen und keine Medienuploads
```

Nach Ablauf zeigt das TAG eine neutrale Ablaufseite. Es darf weder private Daten noch frühere Inhalte offenlegen. Eine Verlängerung oder Übernahme erfordert mindestens ein verifiziertes Nutzerkonto.

### 3.2 Selbstprint-TAG mit verifiziertem Konto

Ein selbstgedrucktes TAG mit verifiziertem Konto soll ausreichend lange funktionieren, damit ein Nutzer echten Alltagsnutzen erfährt. Ein Zeitraum von nur 30 Tagen wäre für Koffer, Fahrrad oder Schlüssel typischerweise zu kurz.

Empfohlener Startdefault:

```text
Bis zu 3 aktive Selbstprint-TAGs je verifiziertem Konto
Laufzeit: 6 Monate
Optionale Verlängerung: bis 12 Monate nach Produktentscheidung
```

Geeignete kostenlose Funktionen:

- öffentliche Bezeichnung und Beschreibung;
- wenige, ausdrücklich öffentliche Bilder oder Links;
- begrenzte Lost-&-Found-Kontaktmöglichkeit;
- einfache öffentliche Vault-Seite;
- einfache Aktualisierung durch den Owner;
- sichtbare, aber nicht aufdringliche Upgrade-Möglichkeit.

Nicht Bestandteil eines Selbstprint-TAGs in der ersten Version:

- große oder zahlreiche Uploads;
- private Vault-Freigaben;
- unbegrenzte Medienabrufe;
- umfangreiche Gästebücher;
- Video;
- dauerhafte OAuth-Verbindungen zu externem Storage;
- Reward- oder Campaign-Funktionen mit hohem Missbrauchspotenzial.

Ein ablaufendes Selbstprint-TAG soll nicht sofort unbrauchbar erscheinen. Die Owner-Ansicht bietet rechtzeitig:

```text
[ Laufzeit verlängern ]
[ Auf physisches myQR24-TAG upgraden ]
[ Inhalte exportieren ]
```

### 3.3 Keine alleinige Account-Grenze

Ein Limit von drei TAGs je Account verhindert nicht, dass Nutzer neue Accounts anlegen. Das System kombiniert deshalb abgestufte und datensparsame Schutzmaßnahmen:

1. bestätigte E-Mail-Adresse;
2. Turnstile bei Registrierung, TAG-Erstellung und Reaktivierung;
3. serverseitige Rate Limits und Cooldowns;
4. Begrenzung kostenintensiver Funktionen im Free-Tarif;
5. Missbrauchs- und Risikosignale zur Drosselung oder manuellen Prüfung;
6. klare Upgrade-Pfade statt Zwang zur Neuanlage;
7. manuelle Ausnahmen für Familien, Schulen, Vereine oder Gruppen.

IP-Adresse, Browsermerkmale und Geräteinformationen dürfen höchstens ergänzende Missbrauchssignale sein. Sie sind keine alleinige Identität und benötigen ein datensparsames, transparentes Datenschutz- und Löschkonzept.

---

## 4. Physische Standard-TAGs und Upgrades

Ein physisches TAG, beispielsweise für einen Koffer, soll einen langfristig verständlichen Nutzen bieten:

```text
Beispiel:
Kaufpreis: 5 EUR einmalig
Gültigkeit: bis zu 5 Jahre
```

Der Produktnutzen liegt nicht primär in großem Speicher, sondern in Verlässlichkeit:

- langlebiges physisches Medium;
- stabile Scan-URL;
- Lost-&-Found-Funktion;
- öffentliche Basisinformationen;
- einfache Aktualisierung;
- definierte Mindestlaufzeit;
- klarer Upgradepfad für größere Vaults oder zusätzliche Features.

Ein einmaliger Produktpreis kann Basisrouting, den begrenzten öffentlichen Inhalt und einen definierten Betriebszeitraum finanzieren. Contentreiche Funktionen werden nicht pauschal aus dem Basispreis subventioniert.

---

## 5. POI-/Community-TAG: Einsatz und Betreiberverantwortung

## 5.1 Geeignete Orte

POI-TAGs eignen sich insbesondere für:

- Gipfelkreuze und Aussichtspunkte;
- Berghütten, Wanderwege und Wegpunkte;
- Museen, Ausstellungen und historische Objekte;
- Vereine, Naturschutz- und Kulturorte;
- touristische Sehenswürdigkeiten;
- Lehrpfade;
- kommunale Informationsorte;
- Veranstaltungen oder zeitlich begrenzte öffentliche Aktionen.

Ein POI-TAG soll einen konkreten öffentlichen Nutzen haben, beispielsweise:

- Geschichte und Beschreibung eines Orts;
- Verhalten-, Sicherheits- oder Naturschutzhinweise;
- Bilder und Audioguide;
- offizieller externer Link zu Betreiber, Tourismusverband oder Karteninformation;
- Check-in für eine persönliche Sammlung;
- moderiertes digitales Gipfel- oder Besucherbuch.

## 5.2 Anbringung ausschließlich mit Zustimmung

Ein POI-TAG darf nicht als beliebig anbringbarer Gratis-QR-Code behandelt werden. Vor Aktivierung müssen Betreiberzustimmung und Verantwortlichkeit dokumentiert sein.

Erforderlich sind mindestens:

| Voraussetzung | Zweck |
| --- | --- |
| verantwortlicher Betreiber | klare Ansprechperson oder Organisation |
| verifizierter Betreiberkontakt | Rückfrage, Sperrung und Verlängerung |
| bestätigter Standort | Zuordnung zu einem konkreten POI |
| dokumentierte Anbringungszustimmung | Eigentümer, Hüttenbetreiber, Verein, Gemeinde, Tourismusorganisation oder sonstige befugte Stelle |
| akzeptierte Nutzungs- und Inhaltsregeln | Schutz vor Missbrauch und unzulässigen Inhalten |
| öffentlicher Meldeweg | Besucher können fehlerhafte oder problematische Inhalte melden |

Bei Natur-, Berg- und Denkmalschutzorten gilt zusätzlich: Genehmigungen und lokale Regeln liegen in der Verantwortung des Betreibers. myQR24 darf nicht behaupten oder implizieren, dass eine Anbringung allgemein erlaubt sei.

## 5.3 POI-Laufzeit und Verlängerung

Empfohlene Startregel:

```text
Kostenloses POI-/Community-TAG:
- 12 Monate gültig
- Verlängerung nach einfacher jährlicher Betreiberbestätigung
- Kündigung, Deaktivierung oder Inhaltsprüfung jederzeit möglich
```

Ein POI-TAG wird nicht allein wegen Ablauf gelöscht. Vor Ablauf erhält der Betreiber mehrere Hinweise. Bei ausbleibender Bestätigung wird die Darstellung zunächst auf eine neutrale, öffentliche Hinweisseite reduziert:

```text
Dieses Informations-TAG wird derzeit überprüft.
Bitte später erneut versuchen.
```

Die Seite enthält keine alten privaten Betreiber- oder Besucherdaten. Nach einer definierten Aufbewahrungsfrist werden Inhalte und personenbezogene Daten gemäß Retention-Regeln gelöscht oder anonymisiert.

## 5.4 Betreiberrollen

| Rolle | Berechtigungen |
| --- | --- |
| `poi-operator` | öffentliche Inhalte pflegen, Betreiberinformationen aktualisieren, Meldungen sehen, Gastbuch moderieren |
| `poi-editor` | Inhalte bearbeiten, aber keine Betreiber-/Abrechnungs- oder Rollenänderung |
| `poi-moderator` | Gästebuchbeiträge prüfen, veröffentlichen, entfernen und melden |
| `organization-admin` | Betreiber bestätigen, Rollen vergeben, mehrere POIs und Kampagnen verwalten |
| `myqr24-platform-admin` | Missbrauch bearbeiten, TAG sperren, Support- und Compliance-Fälle behandeln |

Die Tag-PIN allein ist für einen öffentlichen POI langfristig nicht ausreichend. Mindestens `poi-operator` und `organization-admin` verwenden ein myQR24-Konto mit starker Authentisierung, vorzugsweise Passkey. Eine PIN kann zusätzlich für lokale, niedrigkritische Aktionen genutzt werden, ersetzt aber nicht die Betreiberidentität.

---

## 6. POI-Featureprofil

Ein POI-TAG verwendet eine vorgegebene Konfiguration. Es darf nicht ohne Prüfung beliebige private oder kostenintensive Funktionen aktivieren.

```ts
type TagProductTier =
  | "anonymous-demo"
  | "self-print"
  | "physical-standard"
  | "premium-content"
  | "poi-community"
  | "partner-series";

type PoiKind =
  | "summit"
  | "hut"
  | "trail"
  | "museum"
  | "heritage"
  | "tourism"
  | "community"
  | "event"
  | "other";

type PoiTagSettings = {
  tagId: string;
  tier: "poi-community";
  poiKind: PoiKind;
  operatorOrganizationId?: string;
  operatorAccountId: string;
  status: "pending-verification" | "active" | "review" | "suspended" | "expired";
  approval: {
    placementConfirmedAt: string | null;
    placementConfirmedBy: string | null;
    operatorVerifiedAt: string | null;
  };
  renewalDueAt: string;
  vaultPresentation: "summit-guide" | "museum-exhibit" | "public-page";
  enabledModules: {
    vault: true;
    checkIn: boolean;
    guestbook: boolean;
  };
  publicSafetyNotice?: string;
  reportUrl: string;
};
```

### 6.1 Standardmodule

| Modul | Standard | Funktion |
| --- | --- | --- |
| `tag-vault` | aktiv | kuratierte öffentliche POI-Seite |
| `tag-checkin` | optional, nach Betreiberentscheidung | persönliche Collection oder kontrollierte Kampagne |
| `tag-guestbook` | optional, standardmäßig moderiert | Gipfel-/Besucherbuch |
| `lost-found` | deaktiviert | nur für mobile/private Gegenstände sinnvoll |
| `tag-chat` | deaktiviert | kein offener Kommunikationskanal zu öffentlichen Orten |

### 6.2 Sicheres Präsentationsprofil

| POI-Art | Vault-Präsentation | Geeignete öffentliche Blöcke |
| --- | --- | --- |
| Gipfel / Aussichtspunkt | `summit-guide` | Titelbild, Ortsgeschichte, Sicherheitshinweis, Galerie, Audioguide, Kartenlink |
| Hütte | `summit-guide` oder `public-page` | Betreiberinfos, Öffnungshinweise, Regeln, Kontakt-/Reservierungslink, Galerie |
| Museum / Ausstellung | `museum-exhibit` | Objektbeschreibung, Bild, Audioguide, Quellen-/Weiterführungslink |
| Lehrpfad / Naturort | `public-page` | Text, Bilder, Natur-/Verhaltenshinweise, externer Link |
| Veranstaltung | `public-page` | Programm, Regeln, Informationen, zeitlich begrenztes Guestbook |

POI-Inhalte bestehen ausschließlich aus den sicheren und serverseitig validierten Vault-Blöcken. Freies HTML, JavaScript, iFrames und unbekannte externe Skripte sind nicht zulässig.

### 6.3 Sicherheits- und Rettungshinweise

Ein POI-TAG kann einen sichtbaren Hinweisblock enthalten, beispielsweise:

```text
Wetter und Wege können sich kurzfristig ändern.
Diese Seite ersetzt keine lokale Beschilderung,
amtliche Warnungen oder eine Notfallplanung.
```

Der Betreiber trägt Verantwortung für die Richtigkeit seiner Inhalte. myQR24 speichert im Audit:

- wer einen Sicherheits- oder Betreiberhinweis geändert hat;
- wann die Änderung veröffentlicht wurde;
- welche Inhaltsversion öffentlich aktiv war.

POI-TAGs dürfen keine irreführenden Notfall-, Rettungs- oder Wegfreigabeinformationen automatisch erzeugen. Externe Links zu offiziellen Quellen müssen eindeutig als externe Angebote erkennbar sein.

---

## 7. POI-Check-ins, Collections und Kampagnen

Ein POI-TAG kann `tag-checkin` aktivieren. Die verbindlichen technischen Regeln für GEO-Prüfung, Offline-Synchronisation, Signatur, Collections und Campaigns stehen in [TAG Check-in, Collections & Campaigns](TAG_CHECKIN_COLLECTIONS_CAMPAIGNS.md).

Für POIs gelten zusätzlich folgende Produktregeln:

1. Check-ins sind standardmäßig optional; Besucher dürfen öffentliche POI-Inhalte ohne Konto und ohne Standortfreigabe sehen.
2. Ein Check-in benötigt die in der Check-in-Policy definierte Konto- und Standortzustimmung.
3. Präzise Rohkoordinaten erscheinen niemals öffentlich im Vault oder Gästebuch.
4. Ein Check-in ist kein zuverlässiger Nachweis einer sportlichen Leistung, einer tatsächlichen Besteigung oder eines rechtlich relevanten Aufenthalts.
5. Punkte, Gutscheine oder andere wertvolle Rewards benötigen Online-Prüfung, Accountbindung, Rate Limits und atomare Credits.
6. Nur berechtigte Organisationsrollen dürfen Campaign-Regeln, Reward-Policies oder höhere Credit-Limits setzen.
7. Ein POI-Tag kann bei fehlender Betreiberbestätigung weiterhin als öffentliche Informationsseite bestehen; Check-ins, Campaigns und Gästebuch können separat deaktiviert werden.

Empfohlene Defaults:

| POI-Typ | Check-in-Default | GEO-Default | Collection-Default |
| --- | --- | --- | --- |
| Gipfel | optional | `geo-proximity`, sofern Betreiber Lage und Radius verantwortet | `summit-pass`, `one-per-window`, 24 h |
| Hütte | optional | `geo-proximity` oder `scan-only` bei unklarem Empfang | `hut-pass`, `one-per-window`, 24 h |
| Museum | optional | `scan-only` oder `geo-proximity` | `museum-pass`, `first-ever` |
| Lehrpfad / Wegpunkt | optional | `geo-proximity` | individuelle Collection oder Campaign |
| Veranstaltung | optional | `scan-only` oder Event-Policy | event-/kampagnenspezifisch |

---

## 8. POI-Gästebuch und Moderation

Ein digitales Gipfel- oder Besucherbuch wird ausschließlich über `tag-guestbook` umgesetzt. Die vollständige Spezifikation befindet sich in [TAG Guestbook Feature](TAG_GUESTBOOK_FEATURE.md).

Für POIs gelten strengere Defaults als für private Hochzeiten oder geschlossene Events:

| Einstellung | POI-Default |
| --- | --- |
| Moderationsmodus | `manual` |
| Textbeiträge | erlaubt, begrenzt |
| Bilder | initial deaktiviert oder nur nach Betreiberentscheidung |
| Voice-Nachrichten | initial deaktiviert |
| Standortübermittlung | deaktiviert |
| Veröffentlichung | erst nach Betreiber-/Moderatorfreigabe |
| Check-in-Pflicht | optional, nicht als Standard |
| Meldefunktion | verpflichtend |
| Beitragsfenster | langfristig offen oder saisonal; Betreiber kann es jederzeit schließen |

Zusätzliche Regeln:

- Keine persönlichen Kontakt-, Gesundheits-, Rettungs- oder Standortdaten in öffentlichen Beiträgen.
- Beiträge mit Beleidigungen, Werbung, rechtswidrigen Inhalten, personenbezogenen Daten Dritter oder gefährlichen Falschinformationen werden entfernt.
- Ein Betreiber muss mindestens einen erreichbaren Moderationsprozess besitzen.
- Unmoderierte Auto-Publish-Gästebücher sind für öffentliche POIs in der ersten Produktversion nicht zulässig.
- Bei erheblichem Missbrauch kann myQR24 das Gästebuch sofort auf `read-only`, `closed` oder `disabled` setzen.
- Der POI-Betreiber kann definieren, ob ein qualifizierter Check-in für einen Beitrag erforderlich ist; diese Regel darf keine präzisen Standortdaten veröffentlichen.

---

## 9. Speicher-, Inhalts- und Kostengrenzen

Kostenfreie Verbreitung ist nur nachhaltig, wenn kostenintensive Features begrenzt sind.

### 9.1 Vorgeschlagene Startkontingente

| Produktklasse | Öffentliche Bilder | Öffentlicher Speicher | Private Daten / Freigaben | Guestbook / Check-ins |
| --- | ---:| ---:| --- | --- |
| Anonymes Demo-TAG | 0 | 0 | nicht verfügbar | nicht verfügbar |
| Selbstprint-TAG | z. B. 3 | z. B. 10 MiB | nicht verfügbar | nicht verfügbar |
| Physisches Standard-TAG | z. B. 10 | z. B. 50 MiB | nur definierte Basisfunktionen | optional nach Produkt |
| POI-/Community-TAG | z. B. 20 | z. B. 100 MiB | keine privaten Scannerfreigaben | Check-in optional; Guestbook nur moderiert |
| Premium-/Content-TAG | tarifabhängig | tarifabhängig | nach Tarif | tarifabhängig |

Die Werte sind Startwerte und keine finalen Tarifversprechen. Die autoritative Anwendung prüft Kontingente vor Upload und Veröffentlichung. Sie zählen nicht nur einzelne Dateien, sondern auch Gesamtgröße, Dateityp, Medienvarianten und potenziell teure Abrufe.

### 9.2 Externer Owner-Speicher

Ein POI-Betreiber oder privater Owner kann später eigene Dateien aus Google Drive oder einem ähnlichen Speicher einbringen. Dafür gelten folgende Stufen:

| Stufe | Umsetzung | Freigabe für POI-Startversion |
| --- | --- | --- |
| Externer Link | klar gekennzeichneter, validierter Link zu öffentlichem Material | zulässig, wenn Betreiber Inhalt und Ziel verantwortet |
| Kontrollierter Import | Betreiber autorisiert einmaligen Import; Datei liegt anschließend im Plattform-Object-Store | spätere Erweiterung |
| Dauerhaft verbundener Storage | OAuth-Verbindung und serverseitig verwaltete Tokens | keine Startfunktion; Premium-/Partnererweiterung |

Direkte externe Inhalte werden nicht als private oder sicherheitskritische Plattforminhalte behandelt. Ein externer Link öffnet ein Drittangebot und ist entsprechend zu kennzeichnen.

---

## 10. Lebenszyklus, Sperrung und Meldungen

## 10.1 Statusmodell

```text
pending-verification
  ├─ Betreiber-/Anbringungsprüfung erfolgreich → active
  ├─ Prüfung unvollständig oder Hinweis eingegangen → review
  └─ abgelehnt → suspended

active
  ├─ Moderations- oder Sicherheitsproblem → review
  ├─ schwere Verletzung / Betreiberwunsch → suspended
  └─ jährliche Bestätigung fehlt → expired

expired
  ├─ Betreiber bestätigt → active
  └─ Retention-Frist endet → Inhalte löschen/anonymisieren

review
  ├─ Problem gelöst → active
  └─ Verstoß bestätigt → suspended
```

| Status | Öffentliche Darstellung | Check-in / Gästebuch | Betreiberverwaltung |
| --- | --- | --- | --- |
| `pending-verification` | nicht öffentlich oder neutrale Vorschau | deaktiviert | eingeschränkt |
| `active` | öffentliche POI-Seite | gemäß Konfiguration | aktiv |
| `review` | neutrale Hinweis- oder eingeschränkte Seite | standardmäßig deaktiviert | eingeschränkt |
| `suspended` | neutrale Sperrseite, keine früheren Inhalte | deaktiviert | Support-/Einspruchsweg |
| `expired` | neutrale Verlängerungshinweisseite | deaktiviert | Reaktivierung nach Bestätigung |

## 10.2 Öffentlicher Meldeweg

Jedes aktive POI-TAG zeigt einen klaren, aber nicht dominanten Meldeweg:

```text
[Problem mit diesem Ort oder Inhalt melden]
```

Meldungen enthalten mindestens:

- TAG- bzw. POI-ID;
- Kategorie, z. B. „unzulässige Anbringung“, „falsche Information“, „rechtswidriger Inhalt“, „Sicherheitsproblem“;
- optional Beschreibung und Kontaktmöglichkeit;
- Missbrauchsschutz mit Turnstile und Rate Limits;
- Audit- und Bearbeitungsstatus.

Eine Meldung führt nicht automatisch zur Sperrung. Bei schwerwiegenden Sicherheits- oder Rechtsrisiken darf die Plattform den POI bis zur Prüfung vorläufig deaktivieren.

## 10.3 Betreiberwechsel

Bei Wechsel eines Hüttenbetreibers, Vereins oder Eigentümers muss ein autorisierter `organization-admin` den Betreiberwechsel bestätigen. Die Plattform darf nicht allein auf eine neu eingegebene E-Mail-Adresse vertrauen.

Der Wechsel wird auditierbar protokolliert. Alte Owner-Sessions, Rollen, API-Tokens und externe Storage-Verbindungen werden widerrufen oder überprüft.

---

## 11. Architektur- und Datenregeln

### 11.1 Verantwortungsgrenzen

| Komponente | Verantwortung für POI-TAGs | Nicht verantwortlich für |
| --- | --- | --- |
| Edge Worker | Tag-ID validieren, Range/Feature lösen, Redirect oder Aktionsdokument | Betreiberprüfung, Moderation, GeoFence, Content |
| KV `TAG_CONFIG` | nicht geheime Routingzuordnung und festes PWA-Ziel | POI-Kontakte, Zustimmungsnachweise, Gastbuchinhalte, Geo-Koordinaten |
| Application API | Tier, Betreiberrollen, POI-Status, Kontingente, Moderation, Check-in-Policy | Edge-Range-Auflösung |
| Datenbank | Betreiber- und Anbringungsnachweise, Rollen, Status, Audit, Inhaltsmetadaten | öffentliche Secret-freie Routingkonfiguration |
| Object Storage | validierte Medienobjekte | Autorisierung und Moderationsentscheidung |
| PWA | öffentliche POI-Darstellung und Owner-/Moderator-Oberflächen | clientseitige Autorisierungsentscheidung |

### 11.2 Beispiel-Datenmodell

```sql
CREATE TABLE tag_product_assignments (
  tag_id TEXT PRIMARY KEY,
  tier TEXT NOT NULL CHECK (
    tier IN (
      'anonymous-demo',
      'self-print',
      'physical-standard',
      'premium-content',
      'poi-community',
      'partner-series'
    )
  ),
  starts_at TIMESTAMP NOT NULL,
  expires_at TIMESTAMP NULL,
  max_active_until TIMESTAMP NULL,
  status TEXT NOT NULL CHECK (
    status IN ('active', 'expired', 'suspended', 'deleted')
  ),
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE poi_tag_settings (
  tag_id TEXT PRIMARY KEY,
  poi_kind TEXT NOT NULL,
  operator_organization_id TEXT NULL,
  operator_account_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN (
      'pending-verification',
      'active',
      'review',
      'suspended',
      'expired'
    )
  ),
  placement_confirmed_at TIMESTAMP NULL,
  placement_confirmed_by TEXT NULL,
  operator_verified_at TIMESTAMP NULL,
  renewal_due_at TIMESTAMP NOT NULL,
  vault_presentation TEXT NOT NULL,
  checkin_enabled INTEGER NOT NULL DEFAULT 0,
  guestbook_enabled INTEGER NOT NULL DEFAULT 0,
  public_safety_notice TEXT NULL,
  report_url TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE poi_operator_roles (
  tag_id TEXT NOT NULL REFERENCES poi_tag_settings(tag_id),
  account_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('poi-operator', 'poi-editor', 'poi-moderator', 'organization-admin')
  ),
  granted_by_account_id TEXT NULL,
  granted_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP NULL,
  PRIMARY KEY (tag_id, account_id, role)
);

CREATE TABLE poi_tag_reports (
  id TEXT PRIMARY KEY,
  tag_id TEXT NOT NULL REFERENCES poi_tag_settings(tag_id),
  category TEXT NOT NULL,
  reporter_contact TEXT NULL,
  description TEXT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('open', 'triaged', 'resolved', 'dismissed')
  ),
  created_at TIMESTAMP NOT NULL,
  resolved_at TIMESTAMP NULL,
  resolved_by_account_id TEXT NULL
);
```

Betreiberbestätigungen oder Genehmigungsnachweise können personenbezogene Daten enthalten. Sie sind privat, zugriffsgeschützt, nicht im Vault sichtbar und werden nur solange gespeichert, wie dies für die Betriebs- und Nachweispflicht erforderlich ist.

---

## 12. Akzeptanzkriterien

1. Ein anonymer Nutzer kann maximal ein 30-tägiges Demo-TAG mit minimalem öffentlichen Inhalt erstellen.
2. Ein verifiziertes Konto kann innerhalb der konfigurierten Limits, initial maximal drei, Selbstprint-TAGs mit sechsmonatiger Laufzeit erstellen.
3. Ein Selfprint- oder Free-TAG kann keine unbegrenzten Medien, privaten Freigaben, Videos oder andere kostenintensive Funktionen aktivieren.
4. Ein physisches Standard-TAG kann als langlebiges Produkt mit definierter Laufzeit, Basis-Vault und Lost-&-Found-Funktionen betrieben werden.
5. Ein POI-TAG wird erst öffentlich aktiv, wenn Betreiber und Anbringungszustimmung bestätigt wurden.
6. Ein aktives POI-TAG besitzt einen öffentlichen Meldeweg und mindestens einen berechtigten Betreiber.
7. Ein POI-TAG nutzt ausschließlich sichere Vault-Präsentationsprofile und serverseitig validierte Inhaltsblöcke.
8. Ein POI-Gästebuch verwendet in der ersten Produktversion immer manuelle Moderation; Auto-Publish ist nicht aktivierbar.
9. Ein POI-Check-in ist optional; öffentliche Inhalte bleiben ohne Konto und Standortfreigabe zugänglich.
10. Öffentliche POI-Seiten enthalten keine präzisen Check-in-Rohkoordinaten, privaten Betreiberinformationen oder Moderationsdaten.
11. Ein POI kann bei Moderations-, Sicherheits- oder Genehmigungsproblemen in `review`, `suspended` oder `expired` überführt werden; Check-in und Gästebuch werden dann sofort serverseitig deaktiviert.
12. POI-Betreiberwechsel widerrufen oder prüfen alte Rollen, Sessions, Tokens und externe Storage-Verbindungen.
13. Alle Änderungen an Betreiberstatus, Rollen, Anbringungsbestätigung, Check-in-Policy, Gästebuchstatus und sicherheitsrelevanten öffentlichen Hinweisen sind auditierbar.
14. Der Edge Router enthält keinerlei Betreiber-, Genehmigungs-, Content-, Moderations- oder Standortdaten.

---

## 13. Offene Produktentscheidungen

Vor Implementierung sind diese Fragen verbindlich zu entscheiden:

1. Soll ein Selbstprint-TAG standardmäßig 6 oder 12 Monate gültig sein?
2. Soll die Verlängerung eines Selbstprint-TAGs kostenlos, durch Aktivität verdient oder kostenpflichtig sein?
3. Welche konkrete maximale Zahl aktiver Selbstprint-TAGs gilt je verifiziertem Konto?
4. Welcher Basisumfang an Lost & Found, Bildern und Links gehört in physische Standard-TAGs?
5. Welche Organisationen können kostenlos am POI-/Community-Programm teilnehmen?
6. Welche Nachweisform genügt für eine Anbringungszustimmung, und wann ist eine manuelle Plattformprüfung erforderlich?
7. In welchen Ländern/Regionen startet das POI-Programm und welche lokalen Natur-, Eigentums- oder Denkmalschutzregeln müssen beachtet werden?
8. Wie schnell muss ein POI-Betreiber moderieren, und wann greift die Plattform selbst ein?
9. Ist ein POI-Gästebuch mit Text allein ausreichend für die erste Version oder sollen Bilder später gezielt erlaubt werden?
10. Welches Speicher- und Abrufkontingent ist für kostenlose POI-TAGs wirtschaftlich vertretbar?
11. Welche Verfahren gelten für Einspruch, Betreiberwechsel und Entfernung eines unzulässig angebrachten TAGs?

---

## 14. Verwandte Spezifikationen

- [TAG Vault Feature](TAG_VAULT_FEATURE.md)
- [TAG Check-in, Collections & Campaigns](TAG_CHECKIN_COLLECTIONS_CAMPAIGNS.md)
- [TAG Guestbook Feature](TAG_GUESTBOOK_FEATURE.md)
- [TAG Chat Feature](TAG_CHAT_FEATURE.md)
- [Lost & Found Feature](LOST_FOUND_FEATURE.md)
- [Cloudflare vs. PHP-Webhosting vs. vServer](../10-Architecture/CLOUDFLARE_VS_PHP_HOSTING_VS_VSERVER.md)
