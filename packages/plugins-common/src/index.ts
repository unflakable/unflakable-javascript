// Copyright (c) 2023 Developer Innovations, LLC

import { cosmiconfigSync } from "cosmiconfig";
import { debug as _debug } from "debug";
import { CosmiconfigResult } from "cosmiconfig/dist/types";
import { autoDetectGit } from "./git";

const debug = _debug("unflakable:plugins-common");

export { autoDetectGit };

export type QuarantineMode = "no_quarantine" | "skip_tests" | "ignore_failures";

export type UnflakableConfig = {
  apiBaseUrl: string | undefined;
  enabled: boolean;
  failureRetries: number;
  gitAutoDetect: boolean;
  quarantineMode: QuarantineMode;
  testSuiteId: string;
  uploadResults: boolean;
};

type UnflakableConfigFile = Omit<UnflakableConfig, "testSuiteId"> & {
  testSuiteId: string | undefined;
};

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
  if (typeof configResult.config !== "object") {
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

const mergeConfigWithEnv = (config: UnflakableConfigFile): UnflakableConfig => {
  if (process.env.UNFLAKABLE_ENABLED !== undefined) {
    const enabled = !["false", "0"].includes(process.env.UNFLAKABLE_ENABLED);
    debug(
      `${
        enabled ? "En" : "Dis"
      }abling Unflakable plugin due to environment variable UNFLAKABLE_ENABLED`
    );
    config.enabled = enabled;
  }

  if (
    process.env.UNFLAKABLE_API_BASE_URL !== undefined &&
    process.env.UNFLAKABLE_API_BASE_URL !== ""
  ) {
    debug(
      "Overriding API base URL with environment variable UNFLAKABLE_API_BASE_URL: " +
        process.env.UNFLAKABLE_API_BASE_URL
    );
    config.apiBaseUrl = process.env.UNFLAKABLE_API_BASE_URL;
  }

  if (process.env.UNFLAKABLE_UPLOAD_RESULTS !== undefined) {
    const uploadResults = !["false", "0"].includes(
      process.env.UNFLAKABLE_UPLOAD_RESULTS
    );
    debug(
      `${
        uploadResults ? "En" : "Dis"
      }abling Unflakable upload due to environment variable UNFLAKABLE_UPLOAD_RESULTS`
    );
    config.uploadResults = uploadResults;
  }

  if (
    process.env.UNFLAKABLE_SUITE_ID !== undefined &&
    process.env.UNFLAKABLE_SUITE_ID.length > 0
  ) {
    debug(
      `Using suite ID \`${process.env.UNFLAKABLE_SUITE_ID}\` from environment variable UNFLAKABLE_SUITE_ID`
    );
    return { ...config, testSuiteId: process.env.UNFLAKABLE_SUITE_ID };
  } else if (
    config.testSuiteId !== undefined &&
    config.testSuiteId.length > 0
  ) {
    debug(`Using suite ID \`${config.testSuiteId}\` from config file`);
    return config as UnflakableConfig;
  } else {
    throw new Error(
      "Unflakable test suite ID not found in config file or UNFLAKABLE_SUITE_ID environment " +
        "variable"
    );
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

const loadConfigFileSync = (searchFrom: string): UnflakableConfigFile => {
  const configExplorer = cosmiconfigSync("unflakable", {
    searchPlaces: SEARCH_PLACES,
  });
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
