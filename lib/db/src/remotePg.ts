import {
  bridgeFetch,
  bridgeHealthCheck as runBridgeHealthCheck,
  bridgeTransportStats,
  logBridgeTransportConfig,
} from "./bridgeTransport";

// Default total time for ONE bridge round trip made through pool.query().
const DEFAULT_REQUEST_TIMEOUT_MS =
  Number(process.env.DB_BRIDGE_TIMEOUT_MS) || 40_000;

// Transactions / restores (pool.connect() sessions) can legitimately run for
// minutes, so those keep the long timeout.
const SESSION_REQUEST_TIMEOUT_MS = 650_000;

logBridgeTransportConfig(process.env.DB_BRIDGE_URL);

export { bridgeTransportStats };

/** GET <bridge>/db-health for /api/bridge-health. Never throws. */
export function bridgeHealthCheck() {
  return runBridgeHealthCheck(
    process.env.DB_BRIDGE_URL,
    process.env.DB_BRIDGE_SECRET,
    DEFAULT_REQUEST_TIMEOUT_MS,
  );
}

type QueryConfig = {
  text: string;
  values?: unknown[];
  rowMode?: "array";
  types?: unknown;
};

export type RemoteResult = {
  rows: any[];
  rowCount: number | null;
  command: string;
  oid: number;
  fields: any[];
};

type RemoteError = {
  message?: string;
  code?: string;
  detail?: string;
  hint?: string;
  constraint?: string;
  table?: string;
  column?: string;
};

type BridgeResponse = {
  ok: boolean;
  result?: RemoteResult;
  error?: string | RemoteError;
  sessionId?: string;
};

function getBridgeConfig() {
  const url = process.env.DB_BRIDGE_URL?.replace(/\/+$/, "");
  const secret = process.env.DB_BRIDGE_SECRET;

  if (!url) {
    throw new Error("DB_BRIDGE_URL must be set.");
  }

  if (!secret) {
    throw new Error("DB_BRIDGE_SECRET must be set.");
  }

  return {
    url,
    secret,
  };
}

async function bridgeRequest(
  path: string,
  body: Record<string, unknown>,
  timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<BridgeResponse> {
  const { url, secret } = getBridgeConfig();

  // Connection-establishment failures are retried inside bridgeFetch (see
  // bridgeTransport.ts) - never anything that may have reached the server.
  const response = await bridgeFetch(url, path, secret, {
    method: "POST",
    body: JSON.stringify(body),
    timeoutMs,
  });

  let data: BridgeResponse;

  try {
    data = JSON.parse(response.text) as BridgeResponse;
  } catch {
    throw new Error(
      `Database bridge returned invalid JSON (HTTP ${response.status}).`,
    );
  }

  if (!response.ok || !data.ok) {
    const remoteError =
      typeof data.error === "object" && data.error !== null
        ? data.error
        : undefined;

    const message =
      remoteError?.message ??
      (typeof data.error === "string"
        ? data.error
        : `Database bridge request failed (HTTP ${response.status}).`);

    const error = new Error(message) as Error & {
      code?: string;
      detail?: string;
      hint?: string;
      constraint?: string;
      table?: string;
      column?: string;
    };

    if (remoteError) {
      error.code = remoteError.code;
      error.detail = remoteError.detail;
      error.hint = remoteError.hint;
      error.constraint = remoteError.constraint;
      error.table = remoteError.table;
      error.column = remoteError.column;
    }

    throw error;
  }

  return data;
}

function normalizeQuery(
  query: string | QueryConfig,
  values?: unknown[],
) {
  if (typeof query === "string") {
    return {
      sql: query,
      params: values ?? [],
      rowMode: undefined as "array" | undefined,
      drizzleTypes: false,
    };
  }

  return {
    sql: query.text,
    params: query.values ?? values ?? [],
    rowMode: query.rowMode,
    drizzleTypes: Boolean(query.types),
  };
}

/**
 * Represents one PostgreSQL connection pinned on the cPanel bridge.
 *
 * This is required for:
 *
 * BEGIN
 * query
 * query
 * COMMIT / ROLLBACK
 *
 * All queries using this object carry the same sessionId and therefore
 * execute on the same physical PostgreSQL client on cPanel.
 */
export class RemotePgClient {
  private released = false;

  constructor(
    private readonly sessionId: string,
  ) {}

  async query(
    query: string | QueryConfig,
    values?: unknown[],
  ): Promise<RemoteResult> {
    if (this.released) {
      throw new Error(
        "Cannot query a released remote PostgreSQL client.",
      );
    }

    const normalized = normalizeQuery(query, values);

    const data = await bridgeRequest(
      "/query",
      { ...normalized, sessionId: this.sessionId },
      SESSION_REQUEST_TIMEOUT_MS,
    );

    if (!data.result) {
      throw new Error(
        "Database bridge returned no query result.",
      );
    }

    return data.result;
  }

  async release(_err?: unknown): Promise<void> {
    if (this.released) {
      return;
    }

    this.released = true;

    await bridgeRequest(
      "/session/release",
      { sessionId: this.sessionId },
      60_000,
    );
  }
}

/**
 * pg.Pool-compatible facade used by MedSchoolProffs.
 *
 * There is deliberately NO PostgreSQL TCP connection from Hostinger.
 *
 * Normal query:
 *
 * Hostinger
 *   -> HTTPS bridge
 *   -> cPanel pg.Pool
 *   -> PostgreSQL localhost:5432
 *
 * Transaction:
 *
 * connect()
 *   -> bridge allocates a real pg client
 *   -> returns sessionId
 *   -> all RemotePgClient queries use that same session
 *   -> release() returns the real client to the cPanel pool
 */
export class RemotePgPool {
  async query(
    query: string | QueryConfig,
    values?: unknown[],
  ): Promise<RemoteResult> {
    const normalized = normalizeQuery(query, values);

    const data = await bridgeRequest(
      "/query",
      normalized,
    );

    if (!data.result) {
      throw new Error(
        "Database bridge returned no query result.",
      );
    }

    return data.result;
  }

  async connect(): Promise<RemotePgClient> {
    const data = await bridgeRequest("/session/start", {}, 60_000);

    if (!data.sessionId) {
      throw new Error(
        "Database bridge did not return a session ID.",
      );
    }

    return new RemotePgClient(
      data.sessionId,
    );
  }

  on(
    _event: string,
    _handler: (...args: any[]) => void,
  ) {
    // Compatibility with the pg.Pool API.
    //
    // PostgreSQL socket errors occur on the cPanel side,
    // where the actual pg.Pool has its own error listener.
    return this;
  }

  async end(): Promise<void> {
    // Nothing to close on Hostinger.
    //
    // The actual PostgreSQL connection pool exists inside
    // the cPanel bridge.
  }
}