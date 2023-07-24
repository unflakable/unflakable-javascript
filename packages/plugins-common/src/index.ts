// Copyright (c) 2023 Developer Innovations, LLC

import path from "path";

export {
  QuarantineMode,
  UnflakableConfig,
  UnflakableConfigEnabled,
  UnflakableConfigFile,
  loadApiKey,
  loadConfig,
  loadConfigSync,
  setCosmiconfig,
  setCosmiconfigSync,
} from "./config";
export {
  EnvVar,
  branchOverride,
  commitOverride,
  suiteIdOverride,
  uploadResultsOverride,
} from "./env";
export {
  autoDetectGit,
  getRepoRoot,
  loadGitRepo,
  setSimpleGitFactory,
} from "./git";
export { getTestSuiteManifest } from "./manifest";
export { isTestQuarantined, normalizeTestName } from "./quarantine";

// On Windows, we need to convert backslashes to forward slashes before reporting results to the
// backend or checking whether tests are quarantined.
export const toPosix = (file: string): string =>
  file.split(path.sep).join(path.posix.sep);
