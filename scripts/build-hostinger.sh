#!/usr/bin/env bash

# Builds ready-to-upload packages for Hostinger:
#   hostinger-out/student
#   hostinger-out/admin
#   hostinger-out/api

set -euo pipefail

cd "$(dirname "$0")/.."

API_URL="${API_URL:-https://api.medschoolproffs.live}"
OUT="hostinger-out"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  command -v pnpm >/dev/null 2>&1 || corepack enable

  pnpm install --no-frozen-lockfile

  export VITE_API_BASE_URL="$API_URL"

  pnpm run build:student
  pnpm run build:admin
  pnpm run build:api
fi

rm -rf "$OUT"
mkdir -p "$OUT/student" "$OUT/admin" "$OUT/api"

write_htaccess() {
  cat > "$1/.htaccess" <<HT
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Single-page application routing
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ /index.html [L]

# Cache fingerprinted assets
RewriteRule ^assets/ - [E=LONGCACHE:1]

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  $2
  Header set Cache-Control "public, max-age=31536000, immutable" env=LONGCACHE

  <FilesMatch "\.html$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
HT
}

# =========================
# Student frontend
# =========================

cp -r artifacts/frontend-student/dist/public/. "$OUT/student/"

write_htaccess "$OUT/student" ""

# =========================
# Admin frontend
# =========================

cp -r artifacts/frontend-admin/dist/public/. "$OUT/admin/"

write_htaccess "$OUT/admin" 'Header set X-Robots-Tag "noindex, nofollow"'

# =========================
# API runtime
# =========================

cp -r artifacts/api-server/dist "$OUT/api/dist"
cp -r artifacts/api-server/assets "$OUT/api/assets"

cat > "$OUT/api/package.json" <<'PJ'
{
  "name": "medschoolproffs-api-runtime",
  "private": true,
  "type": "module",
  "main": "server.cjs",
  "scripts": {
    "build": "echo API runtime already built",
    "start": "node --enable-source-maps server.cjs"
  },
  "engines": {
    "node": ">=22"
  },
  "dependencies": {
    "nodemailer": "^6.9.15",
    "pdfjs-dist": "4.10.38",
    "@napi-rs/canvas": "0.1.100"
  }
}
PJ

cat > "$OUT/api/server.cjs" <<'EN'
process.env.NODE_ENV = process.env.NODE_ENV || "production";

import("./dist/index.mjs").catch((err) => {
  console.error("API failed to start:", err);
  process.exit(1);
});
EN

# =========================
# Optional ZIP creation
# =========================

if command -v zip >/dev/null 2>&1; then
  for n in student admin api; do
    (
      cd "$OUT/$n"
      zip -qr "../$n.zip" .
    )
  done

  echo "Done:"
  echo "$OUT/student.zip"
  echo "$OUT/admin.zip"
  echo "$OUT/api.zip"
else
  echo "'zip' not found."
  echo "Zip the CONTENTS of each folder manually if needed."
fi