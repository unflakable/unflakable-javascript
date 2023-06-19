// Copyright (c) 2023 Developer Innovations, LLC

// NB: This file is separate from config-env-vars.ts so that it can be included by skip-tests.ts
// without adding any Node.JS dependencies (since that file needs to run in the browser).

export const CYPRESS_ENV_VAR_CONFIG = "__UNFLAKABLE_CONFIG";
export const CYPRESS_ENV_VAR_MANIFEST = "__UNFLAKABLE_MANIFEST";
export const CYPRESS_ENV_VAR_REPO_ROOT = "__UNFLAKABLE_REPO_ROOT";
