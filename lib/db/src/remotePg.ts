import {
  Agent,
  fetch as undiciFetch,
} from "undici";

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

type NetworkCause = {
  code?: string;
  message?: string;
  errno?: string | number;
  syscall?: string;
  address?: string;
  port?: number;
  hostname?: string;
};

/*
 * Hostinger -> cPanel HTTPS bridge connection.
 *
 * Node's built-in fetch/Undici normally has its own connection timeout
 * of roughly 10 seconds. AbortSignal.timeout() does NOT override that
 * connection-establishment timeout.
 *
 * We therefore provide our own dispatcher with a 30-second TCP/TLS
 * connection timeout.
 */
const bridgeDispatcher = new Agent({
  connect: {
    timeout: 30_000,
  },
});

function getBridgeConfig() {
  const url =
    process.env.DB_BRIDGE_URL?.replace(/\/+$/, "");

  const secret =
    process.env.DB_BRIDGE_SECRET;

  if (!url) {
    throw new Error(
      "DB_BRIDGE_URL must be set.",
    );
  }

  if (!secret) {
    throw new Error(
      "DB_BRIDGE_SECRET must be set.",
    );
  }

  return {
    url,
    secret,
  };
}

function getNetworkCause(
  error: unknown,
): NetworkCause | undefined {
  if (
    !(error instanceof Error) ||
    !("cause" in error)
  ) {
    return undefined;
  }

  const cause = (
    error as Error & {
      cause?: NetworkCause;
    }
  ).cause;

  return cause;
}

/*
 * Only retry failures where the HTTPS connection was never successfully
 * established.
 *
 * We intentionally DO NOT retry arbitrary fetch errors, HTTP failures,
 * PostgreSQL errors, or dropped responses because retrying a SQL POST
 * blindly could execute a write twice.
 */
function isSafeConnectFailure(
  error: unknown,
): boolean {
  const cause = getNetworkCause(error);

  const code = cause?.code;

  return (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "ETIMEDOUT" ||
    code === "ENETUNREACH" ||
    code === "EHOSTUNREACH" ||
    code === "EAI_AGAIN"
  );
}

function sleep(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(
      resolve,
      milliseconds,
    );
  });
}

async function performBridgeFetch(
  url: string,
  secret: string,
  body: Record<string, unknown>,
) {
  return undiciFetch(
    url,
    {
      method: "POST",

      headers: {
        "content-type": "application/json",
        "x-bridge-key": secret,
        accept: "application/json",
      },

      body: JSON.stringify(body),

      /*
       * Overall request timeout.
       *
       * Large backup/restore operations can legitimately take several
       * minutes once the connection has been established.
       */
      signal:
        AbortSignal.timeout(
          650_000,
        ),

      dispatcher:
        bridgeDispatcher,
    },
  );
}

async function bridgeRequest(
  path: string,
  body: Record<string, unknown>,
): Promise<BridgeResponse> {
  const {
    url,
    secret,
  } = getBridgeConfig();

  const requestUrl =
    `${url}${path}`;

  let response: Awaited<
    ReturnType<
      typeof performBridgeFetch
    >
  >;

  try {
    response =
      await performBridgeFetch(
        requestUrl,
        secret,
        body,
      );
  } catch (firstError) {
    /*
     * Retry exactly once only when the connection itself could not
     * be established.
     *
     * UND_ERR_CONNECT_TIMEOUT occurs before the SQL request reaches
     * the bridge, so retrying this case does not duplicate a query.
     */
    if (
      !isSafeConnectFailure(
        firstError,
      )
    ) {
      throw firstError;
    }

    await sleep(750);

    response =
      await performBridgeFetch(
        requestUrl,
        secret,
        body,
      );
  }

  let data: BridgeResponse;

  try {
    data =
      (await response.json()) as BridgeResponse;
  } catch {
    throw new Error(
      `Database bridge returned invalid JSON (HTTP ${response.status}).`,
    );
  }

  if (
    !response.ok ||
    !data.ok
  ) {
    const remoteError =
      typeof data.error === "object" &&
      data.error !== null
        ? data.error
        : undefined;

    const message =
      remoteError?.message ??
      (
        typeof data.error === "string"
          ? data.error
          : `Database bridge request failed (HTTP ${response.status}).`
      );

    const error =
      new Error(
        message,
      ) as Error & {
        code?: string;
        detail?: string;
        hint?: string;
        constraint?: string;
        table?: string;
        column?: string;
      };

    if (remoteError) {
      error.code =
        remoteError.code;

      error.detail =
        remoteError.detail;

      error.hint =
        remoteError.hint;

      error.constraint =
        remoteError.constraint;

      error.table =
        remoteError.table;

      error.column =
        remoteError.column;
    }

    throw error;
  }

  return data;
}

function normalizeQuery(
  query: string | QueryConfig,
  values?: unknown[],
) {
  if (
    typeof query === "string"
  ) {
    return {
      sql: query,
      params:
        values ?? [],
      rowMode:
        undefined as
          | "array"
          | undefined,
      drizzleTypes:
        false,
    };
  }

  return {
    sql:
      query.text,

    params:
      query.values ??
      values ??
      [],

    rowMode:
      query.rowMode,

    drizzleTypes:
      Boolean(
        query.types,
      ),
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

    const normalized =
      normalizeQuery(
        query,
        values,
      );

    const data =
      await bridgeRequest(
        "/query",
        {
          ...normalized,
          sessionId:
            this.sessionId,
        },
      );

    if (!data.result) {
      throw new Error(
        "Database bridge returned no query result.",
      );
    }

    return data.result;
  }

  async release(
    _err?: unknown,
  ): Promise<void> {
    if (this.released) {
      return;
    }

    this.released = true;

    await bridgeRequest(
      "/session/release",
      {
        sessionId:
          this.sessionId,
      },
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
    const normalized =
      normalizeQuery(
        query,
        values,
      );

    const data =
      await bridgeRequest(
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

  async connect():
    Promise<RemotePgClient> {
    const data =
      await bridgeRequest(
        "/session/start",
        {},
      );

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
    _handler: (
      ...args: any[]
    ) => void,
  ) {
    // Compatibility with the pg.Pool API.
    //
    // PostgreSQL socket errors occur on the cPanel side,
    // where the actual pg.Pool has its own error listener.
    return this;
  }

  async end():
    Promise<void> {
    // Nothing to close on Hostinger.
    //
    // The actual PostgreSQL connection pool exists inside
    // the cPanel bridge.
  }
}