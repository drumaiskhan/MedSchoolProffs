import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import compression from "compression";
import pinoHttp from "pino-http";
import multer from "multer";
import router from "./routes";
import { logger } from "./lib/logger";
import { attachUser } from "./middlewares/auth";
import { dbErrorMessage } from "./lib/dbErrors";

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
  res.status(200).json({ status: "ok" });
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

// APP_URL can contain one or more comma-separated origins.
const allowedOrigins = process.env.APP_URL
  ?.split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin:
      allowedOrigins && allowedOrigins.length > 0
        ? allowedOrigins
        : true,
    credentials: true,
  }),
);

// Allow large bulk imports / JSON submissions.
app.use(express.json({ limit: "25mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "25mb",
  }),
);

app.use(cookieParser());

/*
 * TEMPORARY BRIDGE HEALTH TEST
 *
 * Flow:
 *
 * Hostinger API
 *      ↓ HTTPS
 * cPanel DB bridge
 *      ↓ localhost:5432
 * PostgreSQL
 *
 * This route is intentionally registered BEFORE attachUser,
 * because attachUser may touch the existing direct Hostinger
 * PostgreSQL connection.
 */
app.get(
  "/api/bridge-health",
  async (_req: Request, res: Response) => {
    try {
      const bridgeUrl = process.env.DB_BRIDGE_URL;
      const bridgeSecret = process.env.DB_BRIDGE_SECRET;

      if (!bridgeUrl || !bridgeSecret) {
        res.status(500).json({
          ok: false,
          error: "bridge_not_configured",
        });

        return;
      }

      const normalizedBridgeUrl = bridgeUrl.replace(/\/+$/, "");

      const response = await fetch(
        `${normalizedBridgeUrl}/db-health`,
        {
          method: "GET",

          headers: {
            "x-bridge-key": bridgeSecret,
            accept: "application/json",
          },

          signal: AbortSignal.timeout(10000),
        },
      );

      const contentType =
        response.headers.get("content-type") ?? "";

      if (!contentType.includes("application/json")) {
        const body = await response.text();

        logger.error(
          {
            status: response.status,
            contentType,
            body: body.slice(0, 500),
          },
          "Bridge returned a non-JSON response",
        );

        res.status(502).json({
          ok: false,
          error: "bridge_invalid_response",
          status: response.status,
        });

        return;
      }

      const data = await response.json();

      res.status(response.status).json(data);
    } catch (error) {
      logger.error(
        { err: error },
        "DB bridge connection failed",
      );

      res.status(500).json({
        ok: false,
        error: "bridge_unreachable",
        message:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  },
);

// Authentication middleware comes AFTER the bridge test.
app.use(attachUser);

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
