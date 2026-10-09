import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { RemotePgPool } from "./remotePg";

const databaseUrl = process.env.DATABASE_URL;

const bridgeUrl = process.env.DB_BRIDGE_URL;
const bridgeSecret = process.env.DB_BRIDGE_SECRET;

/**
 * Database selection:
 *
 * cPanel:
 *   DATABASE_URL
 *      ↓
 * direct PostgreSQL connection
 *      ↓
 * 127.0.0.1:5432
 *
 * Hostinger fallback:
 *   DB_BRIDGE_URL + DB_BRIDGE_SECRET
 *      ↓
 * HTTPS bridge
 */
if (!databaseUrl && (!bridgeUrl || !bridgeSecret)) {
  throw new Error(
    "DATABASE_URL must be set, or DB_BRIDGE_URL and DB_BRIDGE_SECRET must both be set.",
  );
}

export const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  : new RemotePgPool();

/**
 * Keep the node-postgres Drizzle adapter.
 *
 * The cast is intentional because RemotePgPool is structurally compatible
 * with the runtime operations MedSchoolProffs uses but is not literally pg.Pool.
 */
export const db = drizzle(pool as any, {
  schema,
});

export * from "./schema";

/**
 * Bridge diagnostics remain exported so the Hostinger/bridge deployment
 * can continue to use them when DATABASE_URL is not present.
 */
export {
  bridgeHealthCheck,
  bridgeTransportStats,
} from "./remotePg";

export {
  ensureSchema,
  isSchemaHealthy,
} from "./ensureSchema";
