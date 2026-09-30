# Domain-, AXX- und Routing-Regeln

> Diese Datei ist die zentrale fachliche Referenz für KI-Assistenten und die Implementierung des Edge-Routers. Fachliche Regeln müssen hier versioniert dokumentiert werden, bevor sie produktiv umgesetzt werden.

## Domains

| Domain / Hostname | Zweck | Standardverhalten | Status |
| --- | --- | --- | --- |
| _Noch festzulegen_ |  |  | Entwurf |

## AXX-Spezifikationen

Beschreibe hier die AXX-Identifikatoren, ihr Format, ihre Validierung und ihre Zuordnung zu Mandanten, Produkten oder Zielsystemen.

| Feld | Vorgabe |
| --- | --- |
| Format | _Noch festzulegen_ |
| Beispiel | _Noch festzulegen_ |
| Validierung | _Noch festzulegen_ |
| Auflösung | _Noch festzulegen_ |

## URL-Strukturen

Dokumentiere alle unterstützten öffentlichen URL-Formate und ihre Bedeutung.

| URL-Muster | Bedeutung | Beispiel | Zielauflösung |
| --- | --- | --- | --- |
| _Noch festzulegen_ |  |  |  |

## Range-Mappings

Definiere Nummern-, ID- oder Tokenbereiche und deren Routing-Ziele.

| Bereich | Typ | Ziel / Regel | Bemerkung |
| --- | --- | --- | --- |
| _Noch festzulegen_ |  |  |  |

## Validierungs- und Sicherheitsregeln

- Redirect-Ziele ausschließlich aus vertrauenswürdigen, dokumentierten Quellen verwenden.
- Keine benutzergesteuerten Ziel-URLs ohne strikte Validierung und Allowlisting weiterleiten.
- Ungültige, unbekannte oder gesperrte Tags mit einer eindeutigen Fehlerantwort behandeln.
- Änderungen an URL-Schemata, Bereichen und Domains hier dokumentieren und durch Tests absichern.
