# ADR-002: Administration, Bootstrap und Secret-Grenzen

**Status:** Accepted  
**Datum:** 2026-10-28  
**Entscheidung:** Plattformadministration, Deployment-Verantwortung und Break-glass-Zugang werden getrennt modelliert.

## Kontext

Die TAG Control Plane (TCP) wird die autoritative Verwaltungsquelle für Benutzer, Rollen, TAG-Lebenszyklen, fachliche Freigaben und Audit. Sie benötigt eine sichere Verwaltung privilegierter Nutzer, ohne dass ein Browserzugang zugleich Infrastruktur- oder Secret-Administration ermöglicht.

Insbesondere dürfen SMTP-/Mail-Provider-Credentials, Datenbankzugänge, Cloudflare-Publisher-Tokens, R2-Credentials, Laravel-`APP_KEY` und Deployment-Zugänge weder in TCC-Oberflächen noch in der TCP-Datenbank als administrativ editierbare Klarwerte erscheinen.

## Entscheidung

### 1. Drei getrennte Administrationsebenen

```text
Deployment-/Server-Administration
  → Infrastruktur, Secrets, Deployment und Recovery außerhalb der Anwendung

Bootstrap-/Break-glass-Verfahren
  → kontrollierte Ausnahme außerhalb der normalen Web-UI

Platform-Administration
  → höchste reguläre Rolle innerhalb der TCP-Anwendung
```

#### Deployment-/Server-Administration

Die Deployment-/Server-Administration ist keine TCP- oder TCC-Rolle. Sie verwaltet ausschließlich:

- Laravel-`APP_KEY`;
- Datenbank-, Backup-/Restore- und Secret-Store-Zugänge;
- Mail-Transport-Credentials;
- Cloudflare-, KV- und R2-Publisher-Credentials;
- CORS-Allowlist, TLS, VHost, Cron, Queue, Logging und Monitoring;
- Deployment, Rollback und PHP-/Composer-Laufzeit.

Diese Werte werden deploymentseitig, beispielsweise über serverseitige `.env`-Konfiguration und einen Secret Store, gesetzt. Sie dürfen nicht aus Browsern, TCC-Ansichten, öffentlichen APIs, Logs oder Audit-Metadaten lesbar sein.

TCP/TCC darf lediglich redigierten Betriebsstatus zeigen, etwa `configured`, `not_configured`, Zeitpunkt einer Testzustellung oder letzte erfolgreiche Publisher-Ausführung. Credentials, Tokens, private Schlüssel und vollständige Connection-Strings bleiben verborgen.

#### Bootstrap und Break-glass

Der erste `platform-admin` entsteht nicht durch eine offene Registrierungsroute und nicht durch eine dauerhaft in der Web-UI verfügbare Root-Rolle.

Der Deployment-Prozess stellt einen einmalig nutzbaren und zeitlich begrenzten Bootstrap-Ablauf bereit. Ein serverseitiger Laravel-CLI-Command legt den ersten Plattformadministrator direkt an oder erzeugt eine Einladung für eine deploymentseitig erlaubte E-Mail-Adresse.

Vor vollständiger Aktivierung muss der eingeladene Nutzer mindestens:

1. die E-Mail-Adresse bestätigen;
2. ein starkes Anmeldeverfahren registrieren;
3. verpflichtende MFA registrieren;
4. Recovery-Codes entgegennehmen und bestätigen.

Ein Break-glass-Zugang ist kein normales Konto und keine TCC-Funktion. Er wird ausschließlich durch berechtigten Deployment-/Serverzugriff aktiviert, benötigt einen dokumentierten Grund, ist zeitlich begrenzt, wird auditiert und nach erfolgreicher Wiederherstellung deaktiviert. Soweit organisatorisch möglich, wird er mit Vier-Augen-Freigabe durchgeführt.

#### Platform-Administration

`platform-admin` ist die höchste reguläre TCP-Anwendungsrolle. Sie verwaltet Anwendungsidentitäten und den Sicherheitsrahmen, jedoch keine Infrastruktur-Secrets oder Deployments.

### 2. Minimalrechte von `platform-admin`

| Bereich | Zulässig |
| --- | --- |
| Benutzerzugang | Nutzer einladen, deaktivieren, reaktivieren und Zugang entziehen |
| Rollen | delegierbare fachliche Rollen zuweisen und entziehen |
| MFA und Recovery | MFA-Reset für andere Nutzer nach starker Re-Authentisierung, Begründung und Audit; Recovery-Prozess auslösen |
| Sitzungen | Sitzungen anderer Nutzer widerrufen |
| Organisation | plattformweite Organisationszuordnungen verwalten, sobald die Domäne implementiert ist |
| Audit | redigierte Sicherheits- und Änderungsereignisse lesen |
| Betriebsstatus | redigierten, nicht geheimen Systemstatus sehen; später kontrollierte Testzustellung auslösen |

### 3. Verbotene Rechte von `platform-admin`

Ein `platform-admin` darf nicht:

- Deployment-, Datenbank-, Mail-, Cloudflare-, KV- oder R2-Secrets lesen, setzen oder exportieren;
- Serverdateien, Cron, Composer, Container oder Deployments steuern;
- Cloudflare KV oder R2 direkt und manuell beschreiben;
- Audit-Ereignisse ändern oder löschen;
- MFA-Faktoren, Recovery-Codes oder Passkey-Public-Keys anderer Nutzer einsehen;
- ohne erneute starke Authentisierung eine privilegierte Sicherheitsaktion ausführen;
- sich selbst ohne weitere Kontrolle privilegieren oder den letzten aktiven `platform-admin` deaktivieren;
- fachliche TAG-, QA-, Publish- oder Unpublish-Gates ohne die jeweils notwendige Fachrolle umgehen.

Rollenverwaltung ist serverseitig als begrenzte Delegation umzusetzen: Eine Rolle darf nur zugewiesen werden, wenn sie im delegierbaren Umfang der handelnden Rolle liegt. Der Schutz vor Entfernung des letzten aktiven Platform-Admins muss transaktional und serverseitig erfolgen.

### 4. MFA und E-Mail

Für `platform-admin` und weitere später definierte privilegierte Rollen ist MFA verpflichtend.

Bevorzugte Faktoren:

1. Passkey/WebAuthn;
2. TOTP als kompatibler weiterer Faktor;
3. einmalige Recovery-Codes für kontrollierte Wiederherstellung.

E-Mail dient für Einladungen, Verifikation, Benachrichtigungen und den Beginn eines Recovery-Ablaufs. E-Mail allein ist kein ausreichender zweiter Faktor für privilegierte Administration.

MFA-Reset, Rollenänderung, Session-Widerruf, Einladungsneuversand und sicherheitsrelevante Recovery-Schritte benötigen aktuelle starke Authentisierung, einen Grund soweit fachlich erforderlich sowie ein redigiertes Audit-Ereignis mit Korrelations-ID.

### 5. Weitere Anwendungsrollen

Der endgültige Berechtigungsumfang entsteht iterativ und serverseitig. Für die erste Sicherheits- und Verwaltungsbasis sind mindestens diese Rollen vorgesehen:

| Rolle | Zweck | Ausdrückliche Grenze |
| --- | --- | --- |
| `platform-admin` | Identitäten, delegierbare Rollen, Sicherheitsrahmen | keine Infrastruktur- oder Secret-Rechte |
| `security-auditor` | redigiertes Audit und Sicherheitsereignisse lesen | keine Mutationen |
| `tag-manager` | spätere Pools, Ranges, TAG-Lebenszyklen | keine Identitäts- oder Secret-Verwaltung |
| `content-editor` | spätere öffentliche Inhaltsentwürfe | kein Publish ohne Freigabe |
| `reviewer` | spätere fachliche und POI-bezogene Reviews | keine Infrastrukturrechte |
| `organization-admin` | spätere organisationsgebundene Mitgliedschaften | keine plattformweite Rollenerhöhung |
| `poi-operator`, `poi-editor`, `poi-moderator` | spätere POI-spezifische Betriebsaufgaben | keine Plattformadministration |
| `support-agent` | späterer minimaler Support-Claim-Prozess | keine Rollen-/MFA-/Owner-Übernahme |

Zusätzliche Rollen wie `publisher` werden erst mit dem CP-I04-Outbox- und Publishing-Contract aktiviert. Ein Browser erhält nie Cloudflare-Schreibrechte.

## Konsequenzen

- Die bisher offene CP-I01-Entscheidung zu Authentisierung und MFA wird durch diese ADR fachlich eingegrenzt.
- TCP benötigt vor jeder schreibenden TCC-Funktion serverseitige Authentisierung, CSRF-Schutz, Session-Management, MFA, Delegationsregeln, Re-Authentisierung und Audit.
- Eine TCC-Shell kann vor diesen Funktionen implementiert werden, enthält dann jedoch keine Einladungs-, Rollen-, MFA-Reset-, Publish- oder sonstigen privilegierten Commands.
- Secret-Konfiguration verbleibt bei Deployment-/Server-Administration und wird nicht als CRUD-Funktion in TCC realisiert.
- Der Startpunkt für den ersten `platform-admin` ist ein getesteter, deploymentseitig kontrollierter CLI-Bootstrap-Command.

## Verifikation

Vor Freigabe von CC-I01 sind mindestens nachzuweisen:

1. keine öffentliche Selbstregistrierung oder Root-Admin-Webroute;
2. Bootstrap-Command ist einmalig bzw. kontrolliert wiederholbar und auditiert;
3. privilegierte Accounts können ohne MFA nicht vollständig aktiviert werden;
4. Session-Cookies und CSRF-Schutz erfüllen den CC-US-001-Vertrag;
5. Rollen-, MFA- und Session-Mutationen sind serverseitig autorisiert, re-authentisiert und auditiert;
6. keine Secret-Werte erscheinen in TCC, TCP-API, Logs oder Audit-Metadaten;
7. der letzte aktive Platform-Admin kann nicht über eine normale Verwaltungsaktion entfernt werden.
