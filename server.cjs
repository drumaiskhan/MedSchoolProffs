process.env.NODE_ENV = process.env.NODE_ENV || "production";

import("./dist/index.mjs").catch((err) => {
  console.error("API failed to start:", err);
  process.exit(1);
});
