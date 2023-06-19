// Copyright (c) 2023 Developer Innovations, LLC

import { wrapCypressConfig } from "./index";
import _debug from "debug";
import { require } from "./utils";
import {
  ENV_VAR_USER_CONFIG_JSON,
  ENV_VAR_USER_CONFIG_PATH,
} from "./config-env-vars";
import path from "path";

const debug = _debug("unflakable:config-wrapper");

type LoadedConfig =
  | {
      default: Cypress.ConfigOptions<unknown>;
    }
  | (Cypress.ConfigOptions<unknown> & { default: undefined });

const loadUserConfig = async (): Promise<Cypress.ConfigOptions<unknown>> => {
  if (ENV_VAR_USER_CONFIG_JSON.value !== undefined) {
    debug(`Parsing inline user config ${ENV_VAR_USER_CONFIG_JSON.value}`);

    return JSON.parse(
      ENV_VAR_USER_CONFIG_JSON.value
    ) as Cypress.ConfigOptions<unknown>;
  } else if (ENV_VAR_USER_CONFIG_PATH.value === undefined) {
    throw new Error("No user config to load");
  }

  debug(`Loading user config from ${ENV_VAR_USER_CONFIG_PATH.value}`);

  // Relative paths from the user's config need to resolve relative to the location of their
  // cypress.config.js, not ours. This affects things like webpack for component testing.
  const configPathDir = path.dirname(ENV_VAR_USER_CONFIG_PATH.value);
  debug(`Changing working directory to ${configPathDir}`);
  process.chdir(configPathDir);

  // For CommonJS projects, we need to use require(), at least for TypeScript config files.
  // Dynamic import() doesn't support TypeScript imports in CommonJS projects, at least the way
  // Cypress sets up the environment before loading the config.
  try {
    const config = require(ENV_VAR_USER_CONFIG_PATH.value) as LoadedConfig;
    return config.default ?? config;
  } catch (e) {
    // require() can't import ES modules, so now we try a dynamic import(). This is what gets used
    // for ESM projects.
    debug(`require() failed; attempting dynamic import(): ${e as string}`);
    const config = (await import(
      ENV_VAR_USER_CONFIG_PATH.value
    )) as LoadedConfig;
    return config.default ?? config;
  }
};

const userConfig = await loadUserConfig();
debug("Loaded user config %o", userConfig);

export default wrapCypressConfig(userConfig);
