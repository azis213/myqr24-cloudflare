
# Secret lokal (apps/tag-app/.dev.vars): APP_CONTENT_PUBLISH_KEY_S01=...

curl -X PUT http://127.0.0.1:8787/api/v1/tags/ab12cd/content `  -H "Authorization: Bearer $env:APP_CONTENT_PUBLISH_KEY_S01"`
  -H "Content-Type: application/json" `
  --data-binary "@payload.json"



# Veröffentlichen

curl -X PUT http://127.0.0.1:8787/api/v1/tags/ab12cd/content `  -H "Authorization: Bearer $env:APP_CONTENT_PUBLISH_KEY_S01"`
  -H "Content-Type: application/json" --data-binary "@payload.json"

# Definition zurückholen

curl -i http://127.0.0.1:8787/api/v1/tags/ab12cd/content/document `
  -H "Authorization: Bearer $env:APP_CONTENT_PUBLISH_KEY_S01"

# Mit ETag (304, wenn unverändert)

curl -i http://127.0.0.1:8787/api/v1/tags/ab12cd/content/document `  -H "Authorization: Bearer $env:APP_CONTENT_PUBLISH_KEY_S01"`
  -H 'If-None-Match: "<content_sha256>"'

# DESTRUKTIVER Dev-/Staging-Reset: nur auf entbehrliche D1-Umgebungen ausführen.
# Löscht alle TAG-App Access-, Routing-, Content-, Range- und Global-Daten.
# Vor Remote-Ausführung erst Datenbankname/ID und Umgebung verifizieren.
npx wrangler d1 migrations apply myqr24-tag-app-staging --remote --config wrangler.app-api.toml --env staging

# R2 wird durch D1-Migrationen NICHT geleert. Bucket/Präfixe separat prüfen;
# keine Bucket-weite Löschung ohne bestätigte Eigentümerschaft.
