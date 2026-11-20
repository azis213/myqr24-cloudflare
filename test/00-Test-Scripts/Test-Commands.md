
# Secret lokal (apps/tag-app/.dev.vars): APP_CONTENT_PUBLISH_KEY_S01=...

curl -X PUT http://127.0.0.1:8787/api/v1/tags/ab12cd/content `  -H "Authorization: Bearer $env:APP_CONTENT_PUBLISH_KEY_S01"`
  -H "Content-Type: application/json" `
  --data-binary "@payload.json"
