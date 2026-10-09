Unzip over the project root (replaces 6 files, adds 1).
lib/db/package.json is the ORIGINAL (no undici) so pnpm-lock.yaml stays valid.
New env vars (all optional): DB_BRIDGE_CONNECT_TIMEOUT_MS (8000), DB_BRIDGE_CONNECT_ATTEMPTS (3),
DB_BRIDGE_MAX_SOCKETS (6), DB_BRIDGE_IP_FAMILY (set 4 to force IPv4 only), DB_BRIDGE_TIMEOUT_MS (40000).
