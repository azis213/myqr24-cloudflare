Jetzt lass uns mal nur auf das DB-Design der TAG-APP schauen. Das technische Design ist unter apps\tag-app\database\main.sql. Unabhängig vonder Spezifikation wollen wir das Design schärfen und später die Spezifikation dazu anpassen. Wir konzentrieren uns zunächst nur auf die TAG-APP und späteres Rendering sowie die APIs für das Deployment eines TAG-Templates.

Wir wollen eine möglichs einfache DB für unsere Zwecke haben.


Vereinfache das folgende SQL-Schema für mein Projekt, indem wir überflüssige Komplexität entfernen:

1. Entferne komplexe Format-, Längen- und GLOB/LIKE-Checks (z. B. für Base36-IDs, Zahlenbereichs-Staffelungen, Dateinamen, Pfade oder ID-Präfixe) – diese Validierung gehört in den Anwendungscode.
2. Behalte nur die wirklich wichtigen Datenbank-Constraints: PRIMARY KEY, FOREIGN KEY, UNIQUE, NOT NULL, einfache Enum-/Status-Listen (IN (...)), einfache Wertebereiche (> 0 / >= 0) und offensichtliche Zustands-Invarianten (wie revoked_at bei revoked).
3. Entferne oder reduziere Trigger auf das absolute Minimum, falls sie den Entwicklungsfluss bremsen; erkläre kurz, was du gestrichen hast und was im Code geprüft werden sollte.
