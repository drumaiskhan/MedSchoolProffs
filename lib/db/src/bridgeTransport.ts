import http from "node:http";
import https from "node:https";
import dns from "node:dns";
import zlib from "node:zlib";
import type net from "node:net";
import type tls from "node:tls";

/**
 * Hostinger -> cPanel DB bridge transport (HTTPS, keep-alive).
 *
 * Built on node:https on purpose: no extra dependency (nothing to add to
 * pnpm-lock.yaml), and - more importantly - it lets us know EXACTLY whether a
 * failed request ever reached the server.
 *
 * Retry rule (the only one): a request is retried only when it failed BEFORE
 * the TCP+TLS connection was fully established (DNS failure, connection
 * refused, connect timeout, handshake failure). Application data is only
 * written after the handshake, so nothing was delivered and a retry can never
 * duplicate a SQL write. Anything that fails after the connection was ready
 * (reset mid-request, response timeout, reused-socket reset) is thrown as-is.
 */

const num = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// A healthy TCP+TLS connect to the bridge takes well under a second. A
// connect that has not finished after this long is not going to; a fresh
// attempt (new source port, new DNS answer) is a better bet than waiting.
const CONNECT_TIMEOUT_MS = num(process.env.DB_BRIDGE_CONNECT_TIMEOUT_MS, 8_000);
const CONNECT_ATTEMPTS = Math.floor(num(process.env.DB_BRIDGE_CONNECT_ATTEMPTS, 3));
const RETRY_BACKOFF_MS = 250;
const MIN_ATTEMPT_BUDGET_MS = 3_000;

// Caps simultaneous sockets to the bridge. A page load fans out into several
// API calls, each of which makes several bridge calls; an uncapped burst of
// fresh TLS handshakes from one IP is exactly what per-IP firewall /
// connection-rate rules on shared hosting react to. Extra requests queue.
const MAX_SOCKETS = Math.floor(num(process.env.DB_BRIDGE_MAX_SOCKETS, 6));

// 4 = IPv4 only. Anything else = prefer IPv4 but keep IPv6 as a fallback.
const FORCE_IPV4 = process.env.DB_BRIDGE_IP_FAMILY === "4";

const IDLE_SOCKET_MS = 15_000;

export type BridgeErrorPhase = "connect" | "request";

export type BridgeTransportError = Error & {
  code?: string;
  bridgePhase: BridgeErrorPhase;
  bridgeAttempts: number;
};

const ipv4FirstLookup = (
  hostname: string,
  options: dns.LookupOptions,
  callback: (...args: any[]) => void,
) => {
  dns.lookup(hostname, { ...options, order: "ipv4first" } as dns.LookupOptions, callback as any);
};

const agentOptions: Record<string, unknown> = {
  keepAlive: true,
  keepAliveMsecs: 10_000,
  maxSockets: MAX_SOCKETS,
  maxFreeSockets: MAX_SOCKETS,
  scheduling: "lifo",
  // Idle (free) sockets older than this are destroyed instead of being
  // reused after a middlebox may have silently dropped them.
  timeout: IDLE_SOCKET_MS,
  lookup: ipv4FirstLookup,
  autoSelectFamily: true,
  autoSelectFamilyAttemptTimeout: 750,
  ...(FORCE_IPV4 ? { family: 4 } : {}),
};

const httpsAgent = new https.Agent(agentOptions as https.AgentOptions);
const httpAgent = new http.Agent(agentOptions as http.AgentOptions);

type Stats = {
  requests: number;
  connectFailures: number;
  connectRetries: number;
  requestFailures: number;
  lastConnectFailure: null | {
    at: string;
    code?: string;
    syscall?: string;
    address?: string;
    port?: number;
    afterMs: number;
  };
};

const stats: Stats = {
  requests: 0,
  connectFailures: 0,
  connectRetries: 0,
  requestFailures: 0,
  lastConnectFailure: null,
};

export function bridgeTransportStats() {
  return {
    ...stats,
    config: {
      connectTimeoutMs: CONNECT_TIMEOUT_MS,
      connectAttempts: CONNECT_ATTEMPTS,
      maxSockets: MAX_SOCKETS,
      ipFamily: FORCE_IPV4 ? "ipv4-only" : "ipv4-first-with-fallback",
    },
  };
}

function bridgeLog(event: string, fields: Record<string, unknown>): void {
  // Never log the secret, headers, request bodies or SQL - only where we
  // tried to connect and why it failed.
  // eslint-disable-next-line no-console
  console.warn(`[db-bridge] ${event} ${JSON.stringify(fields)}`);
}

function describeCause(err: unknown) {
  const e = err as {
    code?: string;
    syscall?: string;
    address?: string;
    port?: number;
    errno?: number | string;
    message?: string;
    errors?: Array<{ code?: string; address?: string; port?: number; syscall?: string }>;
  };
  return {
    code: e?.code,
    syscall: e?.syscall,
    address: e?.address,
    port: e?.port,
    errno: e?.errno,
    message: e?.message,
    // With IPv4+IPv6 both tried, Node wraps the per-address failures here.
    attempted: Array.isArray(e?.errors)
      ? e.errors.map((x) => ({ code: x.code, address: x.address, port: x.port, syscall: x.syscall }))
      : undefined,
  };
}

const NON_RETRYABLE_TLS = /CERT|UNABLE_TO|SELF_SIGNED|ERR_TLS|HOSTNAME_MISMATCH|ALTNAME/i;

function isSocketReady(socket: net.Socket): boolean {
  if (socket.connecting) return false;
  const maybeTls = socket as Partial<tls.TLSSocket>;
  // A TLS socket is only usable once the handshake negotiated a protocol.
  if (typeof maybeTls.getProtocol === "function") return maybeTls.getProtocol() != null;
  return true;
}

export type BridgeResult = { status: number; ok: boolean; text: string };

type OneShot = {
  url: URL;
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
  connectTimeoutMs: number;
  totalTimeoutMs: number;
};

function attemptOnce(opts: OneShot): Promise<BridgeResult> {
  return new Promise<BridgeResult>((resolve, reject) => {
    const isHttps = opts.url.protocol === "https:";
    const payload = opts.body === undefined ? undefined : Buffer.from(opts.body);
    let ready = false;
    let settled = false;
    let connectTimer: NodeJS.Timeout | undefined;
    let totalTimer: NodeJS.Timeout | undefined;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      if (connectTimer) clearTimeout(connectTimer);
      if (totalTimer) clearTimeout(totalTimer);
      fn();
    };

    const fail = (err: Error & { code?: string }) =>
      finish(() => {
        const e = err as BridgeTransportError;
        e.bridgePhase = ready ? "request" : "connect";
        reject(e);
      });

    const req = (isHttps ? https : http).request(
      {
        protocol: opts.url.protocol,
        hostname: opts.url.hostname,
        port: opts.url.port || (isHttps ? 443 : 80),
        path: `${opts.url.pathname}${opts.url.search}`,
        method: opts.method,
        agent: isHttps ? httpsAgent : httpAgent,
        headers: {
          ...opts.headers,
          "accept-encoding": "gzip, deflate, br",
          ...(payload ? { "content-length": String(payload.length) } : {}),
        },
      },
      (res) => {
        ready = true;
        const encoding = String(res.headers["content-encoding"] ?? "").toLowerCase();
        let stream: NodeJS.ReadableStream = res;
        if (encoding === "gzip") stream = res.pipe(zlib.createGunzip());
        else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
        else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());
        const chunks: Buffer[] = [];
        stream.on("data", (c: Buffer) => chunks.push(c));
        stream.on("error", (e) => fail(e as Error));
        res.on("error", (e) => fail(e));
        stream.on("end", () =>
          finish(() => {
            const status = res.statusCode ?? 0;
            resolve({
              status,
              ok: status >= 200 && status < 300,
              text: Buffer.concat(chunks).toString("utf8"),
            });
          }),
        );
      },
    );

    req.on("socket", (socket) => {
      const markReady = () => {
        ready = true;
        if (connectTimer) clearTimeout(connectTimer);
      };
      if (isSocketReady(socket)) {
        // Reused keep-alive socket: no connect phase for this request.
        ready = true;
        return;
      }
      connectTimer = setTimeout(() => {
        const e = new Error(
          `Timed out after ${opts.connectTimeoutMs}ms connecting to the database bridge.`,
        ) as Error & { code?: string };
        e.code = "BRIDGE_CONNECT_TIMEOUT";
        req.destroy(e);
      }, opts.connectTimeoutMs);
      socket.once(isHttps ? "secureConnect" : "connect", markReady);
    });

    req.on("error", (err) => fail(err as Error & { code?: string }));

    totalTimer = setTimeout(() => {
      const e = new Error(
        `Database bridge request exceeded ${opts.totalTimeoutMs}ms.`,
      ) as Error & { code?: string };
      e.code = "BRIDGE_REQUEST_TIMEOUT";
      req.destroy(e);
    }, opts.totalTimeoutMs);

    if (payload) req.write(payload);
    req.end();
  });
}

/**
 * One logical bridge request. Retries ONLY connection-establishment failures
 * (see the header comment), only while time is left in `timeoutMs`.
 */
export async function bridgeFetch(
  baseUrl: string,
  path: string,
  secret: string,
  init: { method: "GET" | "POST"; body?: string; timeoutMs: number; maxAttempts?: number },
): Promise<BridgeResult & { attempts: number }> {
  const url = new URL(`${baseUrl}${path}`);
  const headers = {
    "content-type": "application/json",
    "x-bridge-key": secret,
    accept: "application/json",
  };
  const maxAttempts = init.maxAttempts ?? CONNECT_ATTEMPTS;
  const started = Date.now();
  stats.requests += 1;

  for (let attempt = 1; ; attempt += 1) {
    const elapsed = Date.now() - started;
    const remaining = init.timeoutMs - elapsed;
    try {
      const result = await attemptOnce({
        url,
        method: init.method,
        headers,
        body: init.body,
        connectTimeoutMs: Math.min(CONNECT_TIMEOUT_MS, remaining),
        totalTimeoutMs: remaining,
      });
      return { ...result, attempts: attempt };
    } catch (err) {
      const e = err as BridgeTransportError;
      const cause = describeCause(err);
      e.bridgeAttempts = attempt;

      if (e.bridgePhase !== "connect") {
        stats.requestFailures += 1;
        bridgeLog("request-failed", {
          host: url.hostname,
          path: url.pathname,
          attempt,
          afterMs: Date.now() - started,
          ...cause,
        });
        throw e;
      }

      stats.connectFailures += 1;
      stats.lastConnectFailure = {
        at: new Date().toISOString(),
        code: cause.code,
        syscall: cause.syscall,
        address: cause.address,
        port: cause.port,
        afterMs: Date.now() - started,
      };
      bridgeLog("connect-failed", {
        host: url.hostname,
        path: url.pathname,
        attempt,
        maxAttempts,
        afterMs: Date.now() - started,
        ...cause,
      });

      const left = init.timeoutMs - (Date.now() - started);
      const retryable =
        attempt < maxAttempts &&
        left > MIN_ATTEMPT_BUDGET_MS + RETRY_BACKOFF_MS &&
        !(cause.code && NON_RETRYABLE_TLS.test(cause.code));
      if (!retryable) throw e;

      stats.connectRetries += 1;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * attempt));
    }
  }
}

export function logBridgeTransportConfig(bridgeUrl: string | undefined): void {
  let host = "(DB_BRIDGE_URL not set)";
  try {
    if (bridgeUrl) host = new URL(bridgeUrl).hostname;
  } catch {
    host = "(DB_BRIDGE_URL is not a valid URL)";
  }
  // eslint-disable-next-line no-console
  console.log(
    `[db-bridge] transport host=${host} node=${process.version} ` +
      `${JSON.stringify(bridgeTransportStats().config)}`,
  );
}

/**
 * GET <bridge>/db-health, single attempt (no retry, so the numbers show what
 * a real connect does). Never throws.
 */
export async function bridgeHealthCheck(
  baseUrl: string | undefined,
  secret: string | undefined,
  timeoutMs: number,
): Promise<{ status: number; body: unknown; elapsedMs: number }> {
  const started = Date.now();
  if (!baseUrl || !secret) {
    return { status: 500, elapsedMs: 0, body: { ok: false, error: "bridge_not_configured" } };
  }
  try {
    const res = await bridgeFetch(baseUrl.replace(/\/+$/, ""), "/db-health", secret, {
      method: "GET",
      timeoutMs,
      maxAttempts: 1,
    });
    let body: unknown;
    try {
      body = JSON.parse(res.text);
    } catch {
      body = { ok: false, error: "bridge_invalid_response", snippet: res.text.slice(0, 200) };
    }
    return { status: res.status, body, elapsedMs: Date.now() - started };
  } catch (err) {
    const e = err as BridgeTransportError;
    return {
      status: 502,
      elapsedMs: Date.now() - started,
      body: {
        ok: false,
        error: "bridge_unreachable",
        phase: e.bridgePhase,
        cause: describeCause(err),
      },
    };
  }
}
