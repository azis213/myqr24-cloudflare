# Anweisung: Lokale Testumgebung für die TAG-App aufsetzen und starten

## Rolle und Ziel

Handle als erfahrener Entwickler für React-/TypeScript-Anwendungen und Cloudflare Pages/Workers. Untersuche das Repository und erweitere die lokale Testumgebung so, dass die TAG-App reproduzierbar gestartet und über eine lokale URL im Browser getestet werden kann. Die App soll ihre vorgesehenen API-Aufrufe gegen lokale Dienste ausführen können; reale Cloudflare-Ressourcen sind dafür nicht zu verwenden.

Setze die Lösung im bestehenden Projekt um, statt nur ein Konzept zu beschreiben. Aktualisiere die zugehörigen Start-/Stop-Skripte und die Dokumentation der lokalen Testumgebung. Halte die Änderung auf den lokalen Testpfad begrenzt.

## Projektkontext

- Die React-PWA liegt unter `apps/tag-app`.
- Die TAG-App gehört zu einem Cloudflare-Pages-/Workers-System. Ihre öffentliche Route ist `/tag/{tagId}`.
- Der Root-Befehl `npm run dev:app` startet aktuell den Vite-Entwicklungsserver auf `127.0.0.1:5173`. Das ist für UI-Entwicklung geeignet, bildet aber allein keine lokale Pages-/Workers- und API-Umgebung ab.
- Die App-API und der Media-Signer haben eigene Wrangler-Konfigurationen unter `apps/tag-app/wrangler.app-api.toml` und `apps/tag-app/wrangler.media-signer.toml`. Staging-Bindings und externe Ressourcen sind nicht als lokale Testdaten zu verwenden.
- `test/10-test-local` enthält bereits eine Docker-Compose-Umgebung für TAG Control Plane, MySQL, Private Codec und TAG Control Center. Sie wird über `npm run local:up`, `npm run local:down` und `npm run local:test` bedient. Die TAG-App ist dort noch nicht eingebunden.
- Die aktuelle TAG-App-Architektur, Teststrategie und Testdatenregeln stehen in `docs/10-Architecture/TAG_APP_ARCHITECTURE.md` sowie `docs/40-Implementation/tag-app/`.
- Die bisherige Ausgangsidee steht in `docs/00-Refinement/prompts/test-tag-app.md`.

## Anforderungen

1. **Bestehende Umgebung erhalten**
   - Integriere die TAG-App in die vorhandene lokale Testumgebung unter `test/10-test-local`, ohne bestehende TCP-, MySQL-, Codec- oder TCC-Abläufe zu brechen.
   - Prüfe vor Änderungen Ports, Compose-Dienste, Umgebungsvariablen, Healthchecks und Start-/Stop-Skripte. Vermeide Portkonflikte; TCP verwendet standardmäßig `8080`, TCC `5174`.
   - Ergänze `.env.example` nur um nicht geheime, lokale Einstellungen. Lege keine Zugangsdaten oder Secrets in versionierten Dateien ab.

2. **Lokale App und API**
   - Stelle die TAG-App über eine dokumentierte lokale URL bereit. Direkte Deep Links wie `/tag/stagv001` müssen beim Neuladen funktionieren.
   - Verwende für den Integrationstest einen lokalen, Cloudflare-kompatiblen Laufzeitpfad für Pages/Workers (zum Beispiel Wrangler im lokalen Modus), soweit dies mit der vorhandenen Architektur möglich ist. Der bloße Vite-Server darf nicht als Nachweis der API- oder Worker-Integration gelten.
   - Verbinde API-Aufrufe der App ausschließlich mit lokalen API-/Worker-Diensten und lokalen Bindings oder sicheren Test-Doubles. Erfinde keine API-Verträge; orientiere dich an vorhandenem Worker-Code, Tests und Architektur.
   - Lokale Fixtures dürfen nur explizit und gemäß dem vorhandenen Fixture-Schalter genutzt werden. Sie dürfen keine Autorisierungsentscheidung für echte Daten simulieren.
   - Führe keine Deployments durch und ändere keine Staging- oder Produktions-Bindings, Namespaces, Domains oder Secrets.

3. **Start, Bereitschaft und Beenden**
   - Der dokumentierte lokale Startweg muss die App mit der übrigen Testumgebung starten und nach erfolgreichem Start die App-URL sowie relevante API-/Health-URLs ausgeben.
   - Ergänze einen aussagekräftigen Bereitschaftscheck für die App und, soweit vorhanden, ihre lokalen API-Dienste. Ein gestarteter Container allein gilt nicht als bereit.
   - Fehler beim Start, fehlende Voraussetzungen und nicht verfügbare Services müssen mit einer verständlichen Fehlermeldung sichtbar werden.
   - Das Stoppen muss die neu hinzugefügten Dienste beenden, ohne bestehende persistente Testdaten unerwartet zu löschen. Ein Reset mit Datenverlust muss weiterhin ausdrücklich getrennt und klar gewarnt sein.

4. **Sicherheit und lokale Daten**
   - Verwende ausschließlich synthetische, nicht personenbezogene Testdaten.
   - Nutze keine Cloudflare-, Staging-, Produktions- oder echten Benutzer-Zugangsdaten. Secrets gehören ausschließlich in die dafür vorgesehene lokale, ignorierte Umgebung.
   - API-, Session- und private Medienantworten dürfen nicht versehentlich als öffentliche PWA-Shell oder dauerhaft durch den Service Worker gecacht werden.

5. **Dokumentation und Verifikation**
   - Dokumentiere Voraussetzungen, erstmalige Einrichtung, Start, lokale URLs, bekannte Testdaten, Logs, Stoppen und optionales Zurücksetzen in `test/10-test-local/README.md`.
   - Ergänze oder korrigiere passende npm-Skripte und eine kurze Verknüpfung in der Root-Dokumentation, falls erforderlich.
   - Ergänze gezielte Tests für neue Konfiguration oder Start-/Healthcheck-Logik.
   - Verifiziere mindestens den bestehenden relevanten Testlauf und den App-Build. Führe keinen Staging-Deploy aus.

## Akzeptanzkriterien

- Ein Entwickler kann die lokale Umgebung nach dokumentierten Schritten starten und erhält eine funktionierende Browser-URL zur TAG-App.
- `/tag/stagv001` kann direkt aufgerufen und neu geladen werden.
- Die App verwendet im Integrationstest ausschließlich lokale API-/Worker-Dienste oder explizit konfigurierte lokale Test-Doubles.
- Die bestehende TCP-/MySQL-/Codec-/TCC-Testumgebung und ihre Start-, Stop- und Reset-Abläufe funktionieren weiterhin.
- Bereitschaft und Fehler werden nachvollziehbar angezeigt; der Stop-Vorgang löscht keine persistenten Daten.
- Relevante Tests und der TAG-App-Build sind erfolgreich; Änderungen und Grenzen der Lösung sind dokumentiert.

## Arbeitsweise

1. Lies zuerst die genannten Skripte, Compose-Dateien, App-/Worker-Konfigurationen, Tests und Architekturdokumente.
2. Leite den tatsächlich unterstützten lokalen Laufzeitpfad aus vorhandenem Code ab. Falls ein API-Vertrag oder eine externe Voraussetzung fehlt, erfinde keine produktionsähnliche Implementierung; halte die Grenze fest und frage bei einer entscheidenden, nicht lokal lösbaren Produktentscheidung nach.
3. Implementiere die kleinste vollständige lokale Lösung und passe direkt betroffene Tests und Dokumentation an.
4. Führe die gezielten Prüfungen aus und berichte knapp, welche URLs und Befehle funktionieren, welche Tests liefen und welche Einschränkungen verbleiben.
