import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });

  res.setHeader("Cache-Control", "no-store");

  res.json({
    ...data,
    version: "__DEPLOY_COMMIT__",
    deployedAt: "__DEPLOYED_AT__",
    deploymentId: "__DEPLOY_RUN_ID__",
  });
});

export default router;
