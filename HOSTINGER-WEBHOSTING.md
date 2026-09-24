# Deploying on Hostinger web hosting (Business / Cloud — no Docker)

Three sites, one repo:

| Site | Address | Type |
|---|---|---|
| Student | https://medschoolproffs.live | static files |
| Admin | https://admin.medschoolproffs.live | static files |
| API | https://api.medschoolproffs.live | Node.js web app (Express) |

The database stays on Supabase, uploads stay on Cloudinary.
(On a VPS, use `HOSTINGER-DEPLOY.md` instead.)

## 1. Build the packages (on your computer)
```bash
git pull && ./scripts/build-hostinger.sh      # Node 22+; WSL/Git Bash on Windows
```
Produces `hostinger-out/student.zip`, `admin.zip`, `api.zip`. The frontends have the API address baked in
(`API_URL` defaults to `https://api.medschoolproffs.live`; override with `API_URL=... ./scripts/build-hostinger.sh`).

## 2. Domains
hPanel → **Domains**: register `medschoolproffs.live` here (or point its nameservers to Hostinger if it lives elsewhere), then create the subdomains `admin` and `api`. Free SSL is issued automatically once each is added as a website.

## 3. Student and admin (static)
For each of `medschoolproffs.live` and `admin.medschoolproffs.live`: hPanel → **Websites → Add website** (upload / empty site) → open **File Manager** → `public_html` → delete the placeholder → upload the matching zip → **Extract**. Make sure `index.html` and `.htaccess` (hidden file) sit directly in `public_html`.

## 4. API (Node.js)
1. **Websites → Add website → Deploy Web App → Upload your website files** → choose `api.zip`, domain `api.medschoolproffs.live`.
2. Framework: **Express.js** (or **Other**), Node **22**, entry file `server.mjs`, start command `npm start` if asked.
3. **Environment variables** (from your Railway Variables tab):
   - `DATABASE_URL` — Supabase **Session pooler** string
   - `JWT_SECRET` — the same value you use today
   - `APP_URL=https://medschoolproffs.live,https://admin.medschoolproffs.live`
   - `PUBLIC_APP_URL=https://medschoolproffs.live`
   - `NODE_ENV=production`
   - `DEFAULT_ADMIN_EMAIL`, `DEFAULT_ADMIN_PASSWORD` — your own, not the documented default
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   - `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` if you use the AI features
4. Deploy, then open `https://api.medschoolproffs.live/api/healthz`.

## 5. Cut-over from Netlify/Railway
Test everything first on the new addresses. If the domain is currently used by Netlify, copy every MX/TXT record (email!) before changing nameservers or A records. Lower TTL a day ahead. After ~48 h stable, delete the Netlify sites and Railway service.

## Updating later
Re-run `./scripts/build-hostinger.sh`, then re-upload the zip(s) that changed (frontend change → student/admin; backend change → api).

## Watch-outs
- Login cookies work because all three sites share the `medschoolproffs.live` domain.
- The secure book reader renders PDFs on the server (CPU/RAM heavy) — watch the app's resource graphs on the Node.js dashboard.
- Behind Hostinger's proxy layer the visitor IP may need `TRUST_PROXY=2` if rate limits look wrong (default is 1).
