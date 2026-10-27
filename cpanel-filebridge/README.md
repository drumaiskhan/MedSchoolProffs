# cPanel file bridge (big books)

PDFs over 200 MB are kept on your cPanel disk instead of Cloudinary/Drive. Only the API server can read them (it sends a secret);
students always read through the secure reader.

## Install (5 minutes)
1. cPanel -> File Manager -> `public_html/` (the folder of `site.medschoolproffs.live`) -> create folder `filebridge`.
2. Upload `index.php` into it. Copy `config.php.example` to `config.php`, set `secret` to a long random string.
3. Open `https://site.medschoolproffs.live/filebridge/index.php?a=ping` - you should see `{"ok":false,"error":"Unauthorized"}` (that is correct without the secret).
4. On the API server (Hostinger) add env vars, then restart it:
   - `FILE_BRIDGE_SECRET` = the same secret
   - `FILE_BRIDGE_URL` = `https://site.medschoolproffs.live/filebridge/index.php` (optional - defaults to that, built from `DB_BRIDGE_URL`)
   - optional: `BOOK_MAX_MB` (default 700), `BOOK_FROM_DISK_MB` (default 150), `BOOK_DISK_CACHE_DIR` (a folder that survives restarts)
5. Admin -> Books -> Choose PDF. PDFs over 200 MB upload automatically in 8 MB pieces to cPanel. Smaller PDFs still use Cloudinary.

Files live in `~/msp-files/books/` (above `public_html`), so they are never reachable from the web.
If cPanel runs out of space the upload stops with a clear message. Deleting a book permanently also deletes its file here.
