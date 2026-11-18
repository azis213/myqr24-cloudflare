Im Ordner docs\00-Refinement\edge-content-worker\myqr24-api-stg\myqr24-api-stg befindet sich eine erste Version für eine TAG-Content Auflösung.

Ziel ist eine API für ein TAG umzusetzen, um den Content zu einem TAG zu lesen. Ein TAG kann z.B. eine Gellery mit Bildern enthalten oder eine Liste von Dokumenten oder eine Liste wie z.B. eine Reperaturhistorie mit Links auf Medien enthalten, usw.

Für jedes TAG soll es auch eine Beschreibung geben, die das TAG mit Format und Inhalt beschreibt. Um die DB schlank zu halten, wird die Beschreibung eines Tags möglichst als eine JSON-Datei beschrieben, die auch im R2 Storage mit verschiedenen Versionen gespeichert ist.
D.h. in der D1-DB muss pro TAG die TAG-ID zusammen mit der Nummerischen ID stehen. Vielleicht noch der TAG-Type ob VAULT TAG, LOST&FOUND TAG, REDIRECT-TAG usw.

Gleiche dieses Refinment mit der vorhandenen Architektur im Ordner docs\10-Architecture ab und überlege, wie die TAG API als Worker umgesetzt werden kann.

Soll die Implementierung vom edge-router apps\edge-router um einen weiteren Worker ergänzt werden oder ist es besser einen eigenen subfolder tag-api zu verwenden.

Gleiche auch zusätzlich noch die Gedanken im Dokument docs\00-Refinement\edge-content-worker\architektur_refinement_kommerzielle_qr_event_plattform_auf_cloudflare.md ab.

Ziel ist, einen klaren Implementierungsvorschlag zu erstellen.

Erzeuge dazu ein Dokument im Ordner Ordner docs\40-Implementation\tag-api, das noch weiter verfeinert werden kann. Ziel ist die Definition von User-Stories für die Umsetzung analog zur Umsetzung für den Edge-Router im Ordner docs\40-Implementation\edge-router und tag-app im Ordner docs\40-Implementation\tag-app.

Die TAG-API muss über eine Session abgesichert sein.
Die Session kann pro TAG unterschiedlich authorisiert werden. Über eine PIN, über einen Login oder über einen Scan mit der TAG-App, wenn das TAG Public ist. Die Zustände für ein TAG müssten bereits spezifiziert sein.

Ziel ist, dass sich die TAG-API in die Architektur docs\10-Architecture\31-App-Architecture\10-COMPONENTS-AND-APPLICATIONS.md gut einbettet.
