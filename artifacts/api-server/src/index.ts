// Loads .env for local dev and platforms that don't inject env vars
// automatically. Must be the first import — everything else reads
// process.env at module-evaluation time. Safe to keep in production: on
// Replit/Railway/Render, env vars are already set and there's no .env file
// to load, so this is a no-op there.
import "dotenv/config";
import app from "./app";
import { logger } from "./lib/logger";
import { seedDefaultAdmin } from "./lib/seedAdmin";
import { normalizeLegacyRoles } from "./lib/normalizeLegacyRoles";
import { ensureSchema } from "@workspace/db";
import { warmStorageConfigCache } from "./lib/storage";

// Without these, a single unhandled promise rejection ANYWHERE in the
// process — not just inside an Express route, where app.ts's error
// middleware already turns a rejection into a clean JSON 500 — crashes the
// whole Node process (default behavior since Node 15). Every in-flight
// request, on every route, gets its connection abruptly dropped
// (net::ERR_CONNECTION_RESET in the browser) until the process manager
// restarts it. Logging and carrying on is the right trade-off for an admin
// tool like this: a stray rejection in some background/fire-and-forget path
// shouldn't take down every other admin's session. uncaughtException is
// caught too, but treated as a signal to exit after logging — the process
// is in an unknown state at that point, and a process manager (Railway/
// Render/PM2/etc.) restarting it cleanly is safer than limping on.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "[process] Unhandled promise rejection — continuing, but this should be fixed at its source.");
});
process.on("uncaughtException", (err) => {
  logger.error({ err }, "[process] Uncaught exception — exiting so the process manager can restart cleanly.");
  process.exit(1);
});

// Most hosts (Railway, Render, Fly, Replit) inject PORT automatically. For
// local dev without a .env, default to 3001 instead of hard-failing.
const port = Number(process.env["PORT"]) || 3001;

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${process.env["PORT"]}"`);
}

async function main(): Promise<void> {
  // Creates any missing tables/indexes (idempotent, additive-only — see
  // lib/db/ensure-schema.sql). Nothing else below this can work on a fresh
  // database until the tables exist, so this runs first and its failure is
  // logged loudly — a real connection/permissions problem here means the
  // "[migrate]"/"[seed]" failures right after it are just downstream noise.
  try {
    await ensureSchema();
  } catch (err) {
    logger.error({ err }, "[schema] Failed to ensure baseline tables exist — the database connection or permissions are likely the real problem here; the migrate/seed errors that follow are probably just downstream of this.");
  }

  try {
    await normalizeLegacyRoles();
  } catch (err) {
    logger.error({ err }, "[migrate] Failed to normalize legacy 'superadmin' roles to 'admin' — those accounts may still be blocked from the admin UI until this succeeds.");
  }

  try {
    await seedDefaultAdmin();
  } catch (err) {
    logger.error({ err }, "[seed] Failed to seed default admin — the app will still start, but you may need to create an admin manually via /admin-signup/1.");
  }

  // Root-cause fix (round 3, items 2/6/8): warm storage.ts's in-memory
  // Cloudinary cloud-name cache BEFORE the server starts accepting
  // requests. Previously this cache only filled in lazily, async, on the
  // first resolveFileUrl() call — which meant every request in the window
  // between boot and that background fetch resolving got `null` URLs (the
  // "Uploaded, but the file isn't loading back" symptom), on any deployment
  // where the Cloudinary cloud name is DB-configured rather than an env var.
  try {
    await warmStorageConfigCache();
  } catch (err) {
    logger.error({ err }, "[storage] Failed to warm Cloudinary config cache — falling back to lazy refresh.");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

main();
