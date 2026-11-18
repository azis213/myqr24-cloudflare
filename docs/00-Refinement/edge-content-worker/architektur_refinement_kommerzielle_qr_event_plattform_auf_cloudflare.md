# Architektur-Zusammenfassung: Kommerzielle QR-Plattform auf Cloudflare

Diese Dokumentation fasst die architektonischen Entscheidungen, Sicherheitskonzepte und technischen Empfehlungen für den Aufbau einer skalierbaren QR-Code-Event-Plattform auf Basis von **Cloudflare Workers**, **Hono**, **Cloudflare D1**, **Cloudflare R2** und einer **PWA (Cloudflare Pages)** zusammen.

---

## 1. Technologie-Stack & Kommerzielle Rahmenbedingungen

* **Framework (Hono):** Open-Source-Webframework (MIT-Lizenz). Es fallen **keine Lizenzkosten** an – auch nicht bei kommerzieller Nutzung, SaaS-Modellen oder direkter Auslieferung an Kunden-Accounts. Hono reduziert die Code-Komplexität bei wachsenden APIs erheblich (typsicheres Routing, Middleware-Support, native JWT/CORS-Integration).
* **Infrastruktur (Cloudflare):**
  * **Cloudflare Workers:** Edge-Compute für Redirects und Backend-APIs (Paid-Tarif ab $5/Monat empfohlen, um harte Tageslimits des Free-Tarifs bei Event-Peaks zu vermeiden).
  * **Cloudflare D1:** Relationale SQLite-Datenbank am Edge für das Mapping von Tags, Galerien, PINs und Bild-Metadaten.
  * **Cloudflare R2:** S3-kompatibler Object Storage für Medien/Bilder (ohne Egress-Gebühren).
  * **Cloudflare Pages:** Hosting der statischen Frontend-PWA.

---

## 2. Systemarchitektur (3-Säulen-Modell)

Die Plattform trennt Verantwortlichkeiten sauber auf, kann aber wahlweise in einem Monorepo verwaltet werden:

1. **High-Speed Edge-Redirector (`/t/:code`):**
   * Empfängt QR-Scans weltweit im nächsten Rechenzentrum.
   * Entschlüsselt die URL-ID zustandslos (stateless) mittels **Feistel-Chiffre** (bijektive 1:1-Zuordnung ohne vorherige DB-Kollisionsprüfung, Schutz vor ID-Enumeration/Scraping).
   * Führt einen mathematischen Range-Check durch, bevor teure Storage- oder DB-Reads stattfinden.
   * Leitet den Nutzer auf die PWA um.
2. **Backend-API (`api.example.com` mit Hono):**
   * Verwaltet Geschäftslogik, PIN-Validierung, Session-Ausstellung, D1-Abfragen und R2-Uploads.
3. **Frontend Web-App / PWA (`app.example.com` auf Cloudflare Pages):**
   * Bietet die Benutzeroberfläche für Teilnehmer (PIN-Eingabe, Galerie-Ansicht, Bildupload).

---

## 3. Datenmodell & Entkopplung (Mapping-Prinzip)

Um Flexibilität bei Veranstaltungen, Hardware-Defekten oder Mehrfachnutzungen zu gewährleisten, werden **physische QR-Codes (`tag_id`)** strikt von den **Inhalten (`gallery_id`)** entkoppelt:

* **Keine starren Tag-Pfade im Storage:** Bilder werden im R2-Bucket unter ihrer `gallery_id` abgelegt (`/galleries/{gallery_id}/{filename}`), nicht unter der `tag_id`.
* **Datenbank-Mapping in D1:**
  * `tags`: Verknüpft den decodierten Feistel-Code (`tag_id`) mit einer `gallery_id`.
  * `galleries`: Speichert Event-Metadaten sowie die zugangsbeschränkende `event_pin`.
  * `gallery_images`: Speichert alle hochgeladenen Bild-IDs, Dateinamen und Sortierungen dynamisch zur jeweiligen `gallery_id`.
* **Vorteil für Events:** Teilnehmer können kontinuierlich neue Bilder in die Galerie hochladen, während die physischen QR-Codes unverändert bleiben. Die API generiert bei jedem Abruf dynamisch das aktuelle JSON inklusive der R2-Medienlinks.

---

## 4. Mehrstufiges Sicherheitskonzept

Der Zugriff auf Event-Inhalte und Upload-Funktionen ist gegen unbefugte Direktaufrufe abgesichert:

### Stufe 1: Kryptografisch abgesicherter Redirect (Edge $\rightarrow$ PWA)
* Statt geheimer Parameter in der Query-URL (`?secret=...`) erzeugt der Edge-Worker beim QR-Scan ein kurzlebiges, mit `HMAC-SHA256` signiertes Token (inklusive `tagId` und `timestamp`).
* Die Übergabe an die PWA erfolgt über das **URL-Fragment (`#token=...`)**. Da Hashes vom Browser niemals an Server oder in Referrer-Header übertragen werden, bleiben Logs sauber.
* Die PWA liest den Hash beim Start sofort aus, bereinigt die Adresszeile (`window.history.replaceState`) und verifiziert das Token gegen die API. Direkte Aufrufe ohne gültigen Scan zeigen lediglich die Standard-Startseite.

### Stufe 2: Event-PIN & Session-Token (JWT)
* Nach erfolgreichem Scan verlangt die PWA die Eingabe der veranstaltungsspezifischen **PIN** (sofern noch keine gültige Session im Client vorliegt).
* Die Hono-API (`POST /api/v1/auth/pin`) gleicht die PIN mit der D1-Datenbank ab und stellt bei Erfolg ein signiertes **JWT (Session-Token)** aus (z. B. mit 24 Stunden Gültigkeit).
* Alle sensiblen Endpunkte (Galerie-Daten abrufen, Bilder hochladen) werden in Hono über eine zentrale **Auth-Middleware** geschützt, die das `Bearer`-Token im `Authorization`-Header prüft.

---

## 5. Offene Punkte für das nächste Refinement

* [ ] **D1-Datenbank-Schema:** Finales SQL-Schema für `tags`, `galleries` und `gallery_images` definieren (inklusive Indizes und Foreign Keys).
* [ ] **R2-Upload-Pipeline:** Hono-Endpunkt (`POST /api/v1/gallery/upload`) für `multipart/form-data` inkl. Dateigrößen-Validierung, MIME-Type-Check und direktem Stream in Cloudflare R2 ausarbeiten.
* [ ] **Bildoptimierung & Caching:** Entscheidung über Auslieferung via R2 Custom Domain, Cache-Control-Header und ggf. Cloudflare Image Resizing (Thumbnails vs. Vollbild).
* [ ] **PWA-Synchronisation:** Strategie für Live-Updates auf dem Event festlegen (z. B. Pull-to-Refresh, Smart Polling in der PWA).