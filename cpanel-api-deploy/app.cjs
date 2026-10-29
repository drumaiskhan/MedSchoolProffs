import("./dist/index.mjs").catch((error) => {
  console.error("[MedSchoolProffs API] Startup failed:", error);
  process.exit(1);
});
