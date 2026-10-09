import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import pinoHttp from "pino-http";
import multer from "multer";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachUser } from "./middlewares/auth";
import { dbErrorMessage } from "./lib/dbErrors";
import { bridgeHealthCheck, bridgeTransportStats } from "@workspace/db";

const app: Express = express();

// The API sits behind a reverse proxy (Caddy on Hostinger, or Railway/Render's
// edge). Without this, req.ip is the proxy's address for EVERY request, so the
// per-IP rate limits (login, signup, password reset, uploads) would be shared
// by all users and device-session IPs would be wrong. TRUST_PROXY = number of
// proxy hops in front of the API (default 1); set "false" only if the API is
// exposed directly to the internet.
const trustProxyEnv = (process.env.TRUST_PROXY ?? "1").trim();

app.set(
  "trust proxy",
  trustProxyEnv === "false"
    ? false
    : trustProxyEnv === "true"
      ? true
      : /^\d+$/.test(trustProxyEnv)
        ? Number(trustProxyEnv)
        : trustProxyEnv,
);

// ---------------------------------------------------------------------------
// CORS - must be the FIRST middleware so that every response Express itself
// produces (including 4xx/5xx and the timeout guard below) carries the
// Access-Control-* headers, and so OPTIONS preflights are answered without
// touching the database, auth, or the logger.
//
// APP_URL = comma-separated list of allowed origins. Trailing slashes are
// stripped because browsers send Origin WITHOUT one and an exact-match
// against "https://example.com/" would silently fail.
// ---------------------------------------------------------------------------
const allowedOrigins = process.env.APP_URL
  ?.split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

app.use(
  cors({
    origin:
      allowedOrigins && allowedOrigins.length > 0
        ? allowedOrigins
        : true,
    credentials: true,
    // Let browsers cache the preflight so only one OPTIONS per route per day
    // has to cross the host proxy.
    maxAge: 86400,
  }),
);

// ---------------------------------------------------------------------------
// Gateway-timeout guard.
//
// Hostinger's proxy (hcdn) answers 504 with an HTML page and NO CORS headers
// when the app takes too long - which the browser reports as a CORS error.
// If a request is still unanswered after API_REQUEST_TIMEOUT_MS we answer
// ourselves with a JSON 503 (CORS headers already attached above) so the real
// failure is visible. Long-running admin backup / import / export routes are
// exempt.
// ---------------------------------------------------------------------------
const API_REQUEST_TIMEOUT_MS =
  Number(process.env.API_REQUEST_TIMEOUT_MS) || 45_000;

const LONG_RUNNING_PATH =
  /^\/api\/admin\/[^/]*(backup|import|export)|^\/api\/uploads|^\/api\/books/i;

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "OPTIONS" || LONG_RUNNING_PATH.test(req.path) || req.path === "/api/health") {
    next();
    return;
  }

  const timer = setTimeout(() => {
    if (res.headersSent) return;
    logger.error(
      { method: req.method, url: req.originalUrl.split("?")[0], afterMs: API_REQUEST_TIMEOUT_MS },
      "Request exceeded the API timeout guard",
    );
    res.status(503).json({
      error: "The server took too long to respond. Please try again.",
      code: "API_TIMEOUT",
    });
  }, API_REQUEST_TIMEOUT_MS);

  const clear = () => clearTimeout(timer);
  res.on("finish", clear);
  res.on("close", clear);
  next();
});

// Compresses every JSON response over ~1KB.
app.use(compression());

// Disable ETags because API responses should not be browser-cached.
app.set("etag", false);

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.set("Cache-Control", "no-store");
  next();
});

// Lightweight liveness check.
// This intentionally does not touch the database.
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({
    status: "ok",
  });
});

app.use(
  pinoHttp({
    logger,

    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },

      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Allow large bulk imports / JSON submissions.
app.use(
  express.json({
    limit: "25mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "25mb",
  }),
);

app.use(cookieParser());

/*
 * Bridge health check (Hostinger -> cPanel bridge -> PostgreSQL).
 * Registered BEFORE attachUser because attachUser may touch the database.
 * Uses the same keep-alive transport as every query (single attempt, no retry,
 * so elapsedMs shows what a real connect costs). Never returns secrets.
 */
app.get("/api/bridge-health", async (_req: Request, res: Response) => {
  if (!process.env.DB_BRIDGE_URL || !process.env.DB_BRIDGE_SECRET) {
    res.status(500).json({ ok: false, error: "bridge_not_configured" });
    return;
  }
  const { status, body, elapsedMs } = await bridgeHealthCheck();
  res.status(status).json({ ...(body as object), elapsedMs, transport: bridgeTransportStats() });
});

// Authentication middleware comes AFTER the bridge test.
// attachUser only touches the database when the request carries a session
// token. If that lookup fails (bridge/DB hiccup) answer a clean, CORS-safe 503
// instead of an unhandled 500 - and deliberately do NOT fall through as
// "signed out", which would make the frontend bounce a logged-in user to the
// login page on a transient outage.
app.use((req: Request, res: Response, next: NextFunction) => {
  attachUser(req, res, next).catch((err: unknown) => {
    logger.error({ err, url: req.originalUrl.split("?")[0] }, "attachUser failed");
    if (!res.headersSent) {
      res.status(503).json({
        error: "Service temporarily unavailable. Please try again.",
        code: "DB_UNAVAILABLE",
      });
    }
  });
});

// Main application routes.
app.use("/api", router);

// Anything that reaches here is a 404 under /api.
app.use("/api", (_req: Request, res: Response) => {
  res.status(404).json({
    error: "Not found",
  });
});

// Global error handler.
// Must remain LAST.
app.use(
  (
    err: unknown,
    req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    logger.error(
      {
        err,
        url: req.originalUrl,
        method: req.method,
      },
      "Unhandled error",
    );

    if (res.headersSent) {
      return;
    }

    if (err instanceof multer.MulterError) {
      res.status(400).json({
        error:
          err.code === "LIMIT_FILE_SIZE"
            ? "File is too large."
            : err.message,
      });

      return;
    }

    // body-parser errors such as malformed JSON or oversized payloads.
    if (
      err &&
      typeof err === "object" &&
      "type" in err &&
      typeof (err as { status?: unknown }).status === "number"
    ) {
      const bodyErr = err as {
        type?: string;
        status: number;
        message?: string;
      };

      res.status(bodyErr.status).json({
        error:
          bodyErr.type === "entity.too.large"
            ? "That request is too large — try submitting fewer items at once."
            : bodyErr.message || "Invalid request body.",
      });

      return;
    }

    const message = dbErrorMessage(
      err,
      "Something went wrong. Please try again.",
    );

    res.status(500).json({
      error: message,
    });
  },
);

export default app;
