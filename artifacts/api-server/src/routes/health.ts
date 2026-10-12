import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });

  res.json({
    ...data,
    version: process.env.DEPLOY_COMMIT || "unknown",
    deployedAt: process.env.DEPLOYED_AT || "unknown",
  });
});

export default router;
