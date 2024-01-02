// Copyright (c) 2023-2024 Developer Innovations, LLC

import chalk from "chalk";
import { readFileSync } from "fs";
import process from "process";
import { createRequire } from "module";

// Needed so that config-wrapper.ts can be compiled to ESM (which doesn't define `require`).
const _require =
  typeof require !== "undefined" ? require : createRequire(import.meta.url);

export { _require as require };

const CYPRESS_PLUGIN_VERSION: string = (
  JSON.parse(
    // Works for both CommonJS and ESM targets.
    readFileSync(new URL("../package.json", import.meta.url), "utf8")
  ) as { version: string }
).version;

export const userAgent = (cypressVersion: string): string =>
  `unflakable-cypress-plugin/${CYPRESS_PLUGIN_VERSION} (Cypress ${cypressVersion}; Node ${process.version})`;

export const printWarning = (msg: string): void => {
  console.warn(chalk.yellow("WARNING: %s"), msg);
};
