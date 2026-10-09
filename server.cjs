const path = require("node:path");
const { pathToFileURL } = require("node:url");

process.chdir(__dirname);

const apiEntry = path.join(
  __dirname,
  "artifacts",
  "api-server",
  "dist",
  "index.mjs"
);

import(pathToFileURL(apiEntry).href).catch((error) => {
  console.error("Failed to start MedSchoolProffs API:");
  console.error(error);
  process.exit(1);
});