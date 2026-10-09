import { Agent, fetch as undiciFetch } from "undici";

/**
 * Hostinger -> cPanel bridge HTTPS transport.
 *
 * Observed in production: the TLS connect from Hostinger to
 * site.medschoolproffs.live can take well over Node's default 10 s connect
 * timeout (UND_ERR_CONNECT_TIMEOUT). A long connect timeout plus keep-alive
 * (so warm sockets are reused instead of re-handshaking on every query)
 * fixes that, but ONLY if the total time of a request stays below the
 * host proxy's (hcdn) gateway timeout - otherwise the proxy answers 504 with
 * no CORS headers and the browser reports a misleading CORS error.
 */
const CONNECT_TIMEOUT_MS = Number(process.env.DB_BRIDGE_CONNECT_TIMEOUT_MS) || 30_000;

// Default total time for ONE bridge round trip made through pool.query().
const DEFAULT_REQUEST_TIMEOUT_MS =
  Number(process.env.DB_BRIDGE_TIMEOUT_MS) || 40_000;

// Transactions / restores (pool.connect() sessions) can legitimately run for
// minutes, so those keep the long timeout.
const SESSION_REQUEST_TIMEOUT_MS = 650_000;

const bridgeAgent = new Agent({
  connect: { timeout: CONNECT_TIMEOUT_MS },
  keepAliveTimeout: 30_000,
  keepAliveMaxTimeout: 120_000,
  connections: 16,
});

const CONNECT_PHASE_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "ECONNREFUSED",
  "ENOTFOUND",
  "EAI_AGAIN",
]);

function causeCode(err: unknown): string | undefined {
  const cause = (err as { cause?: { code?: string } } | undefined)?.cause;
  return cause?.code ?? (err as { code?: string } | undefined)?.code;
}

/** Low-level fetch against the bridge with the shared agent. */
export function bridgeFetch(
  path: string,
  init: { method: "GET" | "POST"; body?: string; timeoutMs: number },
) {
  const { url, secret } = getBridgeConfig();
  return undiciFetch(`${url}${path}`, {
    method: init.method,
    headers: {
      "content-type": "application/json",
      "x-bridge-key": secret,
      accept: "application/json",
    },
    body: init.body,
    dispatcher: bridgeAgent,
    signal: AbortSignal.timeout(init.timeoutMs),
  });
}

/**
 * GET <bridge>/db-health. Used by /api/bridge-health. Never throws - returns
 * a small diagnostic object instead.
 */
export async function bridgeHealthCheck(): Promise<{
  status: number;
  body: unknown;
  elapsedMs: number;
}> {
  const started = Date.now();
  try {
    const res = await bridgeFetch("/db-health", {
      method: "GET",
      timeoutMs: DEFAULT_REQUEST_TIMEOUT_MS,
    });
    const text = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      body = { ok: false, error: "bridge_invalid_response", snippet: text.slice(0, 300) };
    }
    return { status: res.status, body, elapsedMs: Date.now() - started };
  } catch (err) {
    const cause = (err as { cause?: { code?: string; message?: string } }).cause;
    return {
      status: 502,
      elapsedMs: Date.now() - started,
      body: {
        ok: false,
        error: "bridge_unreachable",
        message: err instanceof Error ? err.message : String(err),
        cause: cause ? { code: cause.code, message: cause.message } : undefined,
      },
    };
  }
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
  const payload = JSON.stringify(body);
  const started = Date.now();

  let response: Awaited<ReturnType<typeof bridgeFetch>>;
  try {
    response = await bridgeFetch(path, { method: "POST", body: payload, timeoutMs });
  } catch (err) {
    // The request never reached the bridge when the failure is in the
    // connect phase, so retrying once is safe even for writes. Only retry if
    // there is still time left inside this request's budget.
    const code = causeCode(err);
    const remaining = timeoutMs - (Date.now() - started);
    if (code && CONNECT_PHASE_CODES.has(code) && remaining > 5_000) {
      await new Promise((r) => setTimeout(r, 500));
      response = await bridgeFetch(path, { method: "POST", body: payload, timeoutMs: remaining });
    } else {
      throw err;
    }
  }

  let data: BridgeResponse;

  try {
    data = (await response.json()) as BridgeResponse;
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