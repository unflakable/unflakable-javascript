// Copyright (c) 2023 Developer Innovations, LLC

import { CosmiconfigResult } from "cosmiconfig/dist/types";
import { cosmiconfig, cosmiconfigSync } from "cosmiconfig";
import _debug from "debug";
import { EnvVar, suiteIdOverride, uploadResultsOverride } from "./env";

const debug = _debug("unflakable:plugins-common:config");

export type QuarantineMode = "no_quarantine" | "skip_tests" | "ignore_failures";

type UnflakableConfigInner = {
  apiBaseUrl: string | undefined;
  failureRetries: number;
  gitAutoDetect: boolean;
  quarantineMode: QuarantineMode;
  uploadResults: boolean;
};

export type UnflakableConfigEnabled = {
  enabled: true;
  testSuiteId: string;
} & UnflakableConfigInner;

export type UnflakableConfig =
  | UnflakableConfigEnabled
  | ({
      enabled: false;
      testSuiteId: string | undefined;
    } & UnflakableConfigInner);

type UnflakableConfigFile = {
  enabled: boolean;
  testSuiteId: string | undefined;
} & UnflakableConfigInner;

const defaultConfig: UnflakableConfigFile = {
  apiBaseUrl: undefined,
  enabled: true,
  failureRetries: 2,
  gitAutoDetect: true,
  quarantineMode: "ignore_failures",
  testSuiteId: undefined,
  uploadResults: true,
};

const validateConfig = (
  configResult: NonNullable<CosmiconfigResult>
): UnflakableConfigFile => {
  debug(`Loaded config from ${configResult.filepath}`);
  // NB: typeof null is "object"
  if (typeof configResult.config !== "object" || configResult.config === null) {
    throw new Error(
      `Invalid Unflakable config found at ${
        configResult.filepath
      } -- should be an object, but found ${typeof configResult.config}`
    );
  }

  return Object.entries(configResult.config as { [s: string]: unknown }).reduce(
    (result: UnflakableConfigFile, [key, value]: [string, unknown]) => {
      const throwUnexpected = (): never => {
        throw new Error(
          `Unexpected value \`${JSON.stringify(value)}\` for ${JSON.stringify(
            key
          )} found in ${configResult.filepath}`
        );
      };

      switch (key) {
        case "apiBaseUrl":
          if (typeof value === "string") {
            return {
              ...result,
              apiBaseUrl: value,
            };
          } else {
            return throwUnexpected();
          }
        case "enabled":
          if (typeof value === "boolean") {
            return {
              ...result,
              enabled: value,
            };
          } else {
            return throwUnexpected();
          }
        case "failureRetries":
          if (
            typeof value === "number" &&
            Number.isInteger(value) &&
            value >= 0
          ) {
            return {
              ...result,
              failureRetries: value,
            };
          } else {
            return throwUnexpected();
          }
        case "gitAutoDetect":
          if (typeof value === "boolean") {
            return {
              ...result,
              gitAutoDetect: value,
            };
          } else {
            return throwUnexpected();
          }
        case "quarantineMode":
          if (
            typeof value === "string" &&
            ["no_quarantine", "skip_tests", "ignore_failures"].includes(value)
          ) {
            return {
              ...result,
              quarantineMode: value as QuarantineMode,
            };
          } else {
            return throwUnexpected();
          }
        case "testSuiteId":
          if (typeof value === "string") {
            return {
              ...result,
              testSuiteId: value,
            };
          } else {
            return throwUnexpected();
          }
        case "uploadResults":
          if (typeof value === "boolean") {
            return {
              ...result,
              uploadResults: value,
            };
          } else {
            return throwUnexpected();
          }
        default:
          throw new Error(
            `Unknown Unflakable config option \`${key}\` found in ${configResult.filepath}`
          );
      }
    },
    { ...defaultConfig }
  );
};

const apiBaseUrlOverride = new EnvVar("UNFLAKABLE_API_BASE_URL");
const apiKey = new EnvVar("UNFLAKABLE_API_KEY");
const enabledOverride = new EnvVar("UNFLAKABLE_ENABLED");

const mergeConfigWithEnv = (
  config: UnflakableConfigFile,
  cliTestSuiteId?: string
): UnflakableConfig => {
  if (enabledOverride.value !== undefined) {
    const enabled = !["false", "0"].includes(enabledOverride.value);
    debug(
      `${
        enabled ? "En" : "Dis"
      }abling Unflakable plugin due to environment variable ${
        enabledOverride.name
      }`
    );
    config.enabled = enabled;
  }

  if (
    apiBaseUrlOverride.value !== undefined &&
    apiBaseUrlOverride.value !== ""
  ) {
    debug(
      `Overriding API base URL with environment variable ${apiBaseUrlOverride.name}: ` +
        apiBaseUrlOverride.value
    );
    config.apiBaseUrl = apiBaseUrlOverride.value;
  }

  if (uploadResultsOverride.value !== undefined) {
    const uploadResults = !["false", "0"].includes(uploadResultsOverride.value);
    debug(
      `${
        uploadResults ? "En" : "Dis"
      }abling Unflakable upload due to environment variable ${
        uploadResultsOverride.name
      }`
    );
    config.uploadResults = uploadResults;
  }

  if (cliTestSuiteId !== undefined) {
    debug(`Using suite ID \`${cliTestSuiteId}\` from CLI`);
    return { ...config, testSuiteId: cliTestSuiteId };
  } else if (
    suiteIdOverride.value !== undefined &&
    suiteIdOverride.value.length > 0
  ) {
    debug(
      `Using suite ID \`${suiteIdOverride.value}\` from environment variable ${suiteIdOverride.name}`
    );
    return { ...config, testSuiteId: suiteIdOverride.value };
  } else if (
    config.testSuiteId !== undefined &&
    config.testSuiteId.length > 0
  ) {
    debug(`Using suite ID \`${config.testSuiteId}\` from config file`);
    return config.enabled
      ? // TypeScript has trouble inferring that these types are correct otherwise.
        { ...config, enabled: true, testSuiteId: config.testSuiteId }
      : { ...config, enabled: false };
  } else if (config.enabled) {
    throw new Error(
      `Unflakable test suite ID not found in config file or ${suiteIdOverride.name} environment ` +
        "variable"
    );
  } else {
    return { ...config, enabled: false };
  }
};

const SEARCH_PLACES = [
  "package.json",
  "unflakable.json",
  "unflakable.js",
  "unflakable.cjs",
  "unflakable.yml",
  "unflakable.yaml",
];

// Used for testing.
export const setCosmiconfig = (config: typeof cosmiconfig): void => {
  (
    globalThis as {
      __unflakableCosmiconfig?: typeof cosmiconfig;
    }
  ).__unflakableCosmiconfig = config;
};

export const setCosmiconfigSync = (config: typeof cosmiconfigSync): void => {
  (
    globalThis as {
      __unflakableCosmiconfigSync?: typeof cosmiconfigSync;
    }
  ).__unflakableCosmiconfigSync = config;
};

const loadConfigFile = async (
  searchFrom: string
): Promise<UnflakableConfigFile> => {
  const configExplorer = (
    (
      globalThis as {
        __unflakableCosmiconfig?: typeof cosmiconfig;
      }
    ).__unflakableCosmiconfig ?? cosmiconfig
  )("unflakable", {
    searchPlaces: SEARCH_PLACES,
  });
  debug(`Searching for config from directory \`${searchFrom}\` upward`);
  const configResult = await configExplorer.search(searchFrom);
  if (configResult !== null) {
    return validateConfig(configResult);
  } else {
    debug("No config file found; using defaults");
    return { ...defaultConfig };
  }
};

export const loadConfig = (
  searchFrom: string,
  testSuiteId?: string
): Promise<UnflakableConfig> =>
  loadConfigFile(searchFrom).then((config) =>
    mergeConfigWithEnv(config, testSuiteId)
  );

const loadConfigFileSync = (searchFrom: string): UnflakableConfigFile => {
  const configExplorer = (
    (
      globalThis as {
        __unflakableCosmiconfigSync?: typeof cosmiconfigSync;
      }
    ).__unflakableCosmiconfigSync ?? cosmiconfigSync
  )("unflakable", {
    searchPlaces: SEARCH_PLACES,
  });
  debug(`Searching for config from directory \`${searchFrom}\` upward`);
  const configResult = configExplorer.search(searchFrom);
  if (configResult !== null) {
    return validateConfig(configResult);
  } else {
    debug("No config file found; using defaults");
    return { ...defaultConfig };
  }
};

export const loadConfigSync = (searchFrom: string): UnflakableConfig =>
  mergeConfigWithEnv(loadConfigFileSync(searchFrom));

export const loadApiKey = (): string => {
  if (apiKey.value !== undefined && apiKey.value !== "") {
    return apiKey.value;
  } else {
    throw new Error(`missing required environment variable \`${apiKey.name}\``);
  }
};
