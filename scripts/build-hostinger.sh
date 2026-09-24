#!/usr/bin/env bash
# Builds ready-to-upload packages for Hostinger WEB HOSTING (Business/Cloud, no Docker):
#   hostinger-out/student.zip  -> static site for  medschoolproffs.live
#   hostinger-out/admin.zip    -> static site for  admin.medschoolproffs.live
#   hostinger-out/api.zip      -> Node.js app for  api.medschoolproffs.live
#
# Run from anywhere:   API_URL=https://api.medschoolproffs.live ./scripts/build-hostinger.sh
# (Use WSL or Git Bash on Windows. Needs Node 22+.)
set -euo pipefail
cd "$(dirname "$0")/.."

API_URL="${API_URL:-https://api.medschoolproffs.live}"
OUT="hostinger-out"

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  command -v pnpm >/dev/null 2>&1 || corepack enable
  pnpm install --no-frozen-lockfile
  # Frontends call the API on its own subdomain (baked in at build time).
  export VITE_API_BASE_URL="$API_URL"
  pnpm run build:student
  pnpm run build:admin
  pnpm run build:api
fi

rm -rf "$OUT" && mkdir -p "$OUT/student" "$OUT/admin" "$OUT/api"

write_htaccess() { # $1 = target dir, $2 = extra header line (may be empty)
  cat > "$1/.htaccess" <<HT
RewriteEngine On

# Force HTTPS
RewriteCond %{HTTPS} !=on
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]

# Single-page app: unknown paths serve index.html
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ /index.html [L]

# Fingerprinted build files (/assets/*) can be cached for a year
RewriteRule ^assets/ - [E=LONGCACHE:1]

<IfModule mod_headers.c>
  Header set X-Content-Type-Options "nosniff"
  $2
  Header set Cache-Control "public, max-age=31536000, immutable" env=LONGCACHE
  <FilesMatch "\.html\$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
</IfModule>
HT
}

# ---- static frontends -------------------------------------------------------
cp -r artifacts/frontend-student/dist/public/. "$OUT/student/"
write_htaccess "$OUT/student" ""
cp -r artifacts/frontend-admin/dist/public/. "$OUT/admin/"
write_htaccess "$OUT/admin" 'Header set X-Robots-Tag "noindex, nofollow"'

# ---- API (self-contained Node app) -----------------------------------------
cp -r artifacts/api-server/dist "$OUT/api/dist"
cp -r artifacts/api-server/assets "$OUT/api/assets"   # watermark font for the book reader
cat > "$OUT/api/package.json" <<'PJ'
{
  "name": "medschoolproffs-api-runtime",
  "private": true,
  "type": "module",
  "main": "server.cjs",
  "scripts": { "start": "node --enable-source-maps server.cjs" },
  "engines": { "node": ">=22" },
  "dependencies": {
    "nodemailer": "^6.9.15",
    "pdfjs-dist": "4.10.38",
    "@napi-rs/canvas": "0.1.100"
  }
}
PJ
# CommonJS entry that loads the ESM bundle: works whether the host starts the app
# with node directly or through a Passenger-style loader (which can't take an ESM
# entry file). Also defaults NODE_ENV to production (dev logging needs pino-pretty).
cat > "$OUT/api/server.cjs" <<'EN'
process.env.NODE_ENV = process.env.NODE_ENV || "production";
import("./dist/index.mjs").catch((err) => {
  console.error("API failed to start:", err);
  process.exit(1);
});
EN

# ---- zips (files at the zip root, as Hostinger expects) --------------------
if command -v zip >/dev/null 2>&1; then
  for n in student admin api; do (cd "$OUT/$n" && zip -qr "../$n.zip" .); done
  echo "Done: $OUT/student.zip  $OUT/admin.zip  $OUT/api.zip"
else
  echo "'zip' not found - zip the CONTENTS of each folder in $OUT/ yourself (student, admin, api)."
fi
