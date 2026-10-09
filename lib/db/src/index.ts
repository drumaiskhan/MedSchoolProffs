import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { RemotePgPool } from "./remotePg";

const bridgeUrl = process.env.DB_BRIDGE_URL;
const bridgeSecret = process.env.DB_BRIDGE_SECRET;

if (!bridgeUrl) {
  throw new Error(
    "DB_BRIDGE_URL must be set.",
  );
}

if (!bridgeSecret) {
  throw new Error(
    "DB_BRIDGE_SECRET must be set.",
  );
}

/**
 * PostgreSQL now lives behind the authenticated cPanel HTTPS bridge.
 *
 * Hostinger does NOT open a direct TCP connection to PostgreSQL.
 *
 * Flow:
 *
 * MedSchoolProffs API
 *        |
 *        v
 * RemotePgPool
 *        |
 *      HTTPS
 *        |
 *        v
 * cPanel DB bridge
 *        |
 *        v
 * pg.Pool
 *        |
 *        v
 * 127.0.0.1:5432
 *        |
 *        v
 * cPanel PostgreSQL
 */
export const pool = new RemotePgPool();

/**
 * Keep the existing node-postgres Drizzle adapter.
 *
 * RemotePgPool implements the Pool behavior MedSchoolProffs uses.
 * The cast is intentional because RemotePgPool is structurally compatible
 * with the runtime operations we need but is not literally pg.Pool.
 */
export const db = drizzle(
  pool as any,
  {
    schema,
  },
);

export * from "./schema";

export { bridgeHealthCheck, bridgeTransportStats } from "./remotePg";

export {
  ensureSchema,
  isSchemaHealthy,
} from "./ensureSchema";