# v108 - big books (200 MB+) on cPanel storage

- `cpanel-filebridge/` (PHP, upload to `public_html/filebridge/` on site.medschoolproffs.live): append/finish/stat/get(Range)/delete, shared secret header `X-Bridge-Secret`, files in `~/msp-files/books/` (outside web root). Only `books/<id>.pdf` names accepted.
- API: `lib/cpanelFiles.ts` (FILE_BRIDGE_SECRET, FILE_BRIDGE_URL or derived from DB_BRIDGE_URL). `POST /api/uploads/book-chunk?id&offset[&last=1]` (admin, raw 8 MB pieces, idempotent retries) -> `storagePath = cpanel:books/<id>.pdf`.
- `resolveFileUrl('cpanel:...')` is null on purpose (students only read through the secure reader); permanent delete removes the cPanel file too (deleteFromCloudinary handles `cpanel:`).
- `bookReader.loadBook`: cpanel paths are fetched with the secret into the server disk cache; limit is BOOK_MAX_MB (default 700); books above BOOK_FROM_DISK_MB (default 150) are opened by pdf.js from the disk file (`url: file://`) instead of RAM. Not run against real pdfjs here - test one 200 MB+ book after deploy.
- Admin Books: PDFs >= 200 MB upload in pieces with a % readout; smaller PDFs still use Cloudinary; no auto-thumbnail for big ones (upload a cover).
- Set BOOK_DISK_CACHE_DIR to a persistent folder, otherwise every restart re-downloads big books from cPanel.
