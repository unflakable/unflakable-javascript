// Copyright (c) 2023 Developer Innovations, LLC

import { EnvVar } from "@unflakable/plugins-common";

export const ENV_VAR_AUTO_SUPPORT = new EnvVar("__UNFLAKABLE_AUTO_SUPPORT");

// Serialized copy of the Unflakable config (after resolving all CLI options, environment variables,
// and config file contents.
export const ENV_VAR_UNFLAKABLE_RESOLVED_CONFIG_JSON = new EnvVar(
  "__UNFLAKABLE_RESOLVED_CONFIG_JSON"
);

// Cypress config passed via --config Cypress CLI option.
export const ENV_VAR_USER_CONFIG_JSON = new EnvVar(
  "__UNFLAKABLE_USER_CONFIG_JSON"
);

// Cypress config file path passed via --configFile Cypress CLI option or discovered by searching
// for a Cypress config file.
export const ENV_VAR_USER_CONFIG_PATH = new EnvVar(
  "__UNFLAKABLE_USER_CONFIG_PATH"
);
