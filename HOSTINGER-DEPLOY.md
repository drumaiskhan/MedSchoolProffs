# Deploying on Hostinger (VPS) — replaces Netlify + Railway

Layout: one Hostinger VPS runs two containers.
`web` (Caddy) serves the student and admin frontends over HTTPS and forwards `/api/*` to `api` (Express).
The database stays on Supabase. Uploads stay on Cloudinary.

| Address | Serves |
|---|---|
| `https://yourdomain.com` (+ `www` redirect) | student app |
| `https://admin.yourdomain.com` | admin app |
| `/api/*` on both | the API (same origin, so login cookies just work) |

## 1. Buy the VPS and the domain
1. hostinger.com → **VPS Hosting** → pick **KVM 2** (2 vCPU / 8 GB — comfortable for building the frontends). KVM 1 works if you add swap.
2. Pick a 12/24-month term, Ubuntu 24.04 (the **"Ubuntu with Docker"** template if offered), set a root password, add your SSH key if you have one.
3. Domain: in the checkout, claim the free domain if the plan includes one; otherwise hPanel → **Domains → Get a new domain**. Already own the domain somewhere else (Netlify, Namecheap…)? **Don't transfer it yet** — just edit its DNS in step 5. You can transfer later, once everything is stable.

## 2. Prepare the server
hPanel → **VPS → Manage** → copy the **IP address**; use the **Browser terminal** or `ssh root@IP`.
```bash
# skip if you used the Docker template
curl -fsSL https://get.docker.com | sh
# firewall: SSH + web only
ufw allow OpenSSH && ufw allow 80,443/tcp && ufw allow 443/udp && ufw --force enable
# optional swap (needed on KVM 1)
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile && echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 3. Get the code and configure
```bash
git clone https://github.com/YOU/YOUR-REPO.git app && cd app     # private repo: use a token or deploy key
cp hostinger.env.example .env && nano .env
```
Fill `.env` from your Railway **Variables** tab — reuse the same `JWT_SECRET`, `DATABASE_URL` (Supabase, use the **Session pooler** string), SMTP, Cloudinary, and AI keys. Set `STUDENT_DOMAIN`, `ADMIN_DOMAIN`, `ACME_EMAIL`, and **your own** `DEFAULT_ADMIN_*` (never leave the documented default password).
If Supabase network restrictions are on, allow the VPS IP.

## 4. Start it
```bash
docker compose up -d --build     # first build takes several minutes
docker compose logs -f api       # look for "Server listening"
```
Later updates: `git push` from your machine, then on the VPS `./deploy.sh`.

## 5. DNS cut-over (minimal downtime)
1. **A day before**: at your current DNS provider, lower TTL on the records to 300 s.
2. **Copy every existing record you don't own the meaning of** — especially **MX / TXT (SPF, DKIM, DMARC)** — or email breaks.
3. Where DNS lives:
   - Domain bought at Hostinger: hPanel → **Domains → Manage → DNS / Nameservers → DNS records**. Delete old `A`/`AAAA`/`CNAME` for `@`, `www`, `admin`, then add `A @ → VPS IP`, `A www → VPS IP`, `A admin → VPS IP`.
   - Domain elsewhere: make the same three `A` records in that provider's DNS (if it's on Netlify DNS, edit it there).
4. Switch **`admin` first**: open `https://admin.yourdomain.com`, log in, upload a file. Caddy fetches the HTTPS certificate on its own once DNS points to the VPS (may take a few minutes).
5. Then switch `@` and `www`. Test signup, login, password-reset email, book reader.
6. If anything is wrong, point the records back — Netlify/Railway are untouched until step 7.

## 6. Checks
`https://yourdomain.com/api/healthz` returns OK · login persists after refresh · `docker compose ps` shows both containers healthy.

## 7. Decommission (after ~48 h of stable running)
Delete the Netlify sites and Railway service. Keep Supabase and Cloudinary. Optionally transfer the domain to Hostinger (Domains → Transfer; needs the unlock + auth code from the old registrar).

## Notes
- The API now trusts one proxy hop (`TRUST_PROXY=1`) so per-IP rate limits and device tracking see real visitor IPs.
- Mobile (Capacitor) builds need an absolute API URL. If you ship them, add an `api.yourdomain.com` block in `Caddyfile` proxying to `api:3001`, add its DNS record, and set `VITE_API_BASE_URL` at build time.
- Backups: Hostinger takes weekly VPS snapshots; database backups are Supabase's.
