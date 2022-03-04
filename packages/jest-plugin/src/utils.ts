// Copyright (c) 2022 Developer Innovations, LLC

import type { AssertionResult, Status } from "@jest/test-result";
import { QuarantineMode, UnflakableConfig } from "./types";
import { cosmiconfigSync } from "cosmiconfig";
import jestPackage from "jest/package.json";

import _debug = require("debug");

const debug = _debug("unflakable:utils");

const JEST_PLUGIN_VERSION: string =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require("../package.json") as { version: string }).version;
export const USER_AGENT = `unflakable-jest-plugin/${JEST_PLUGIN_VERSION} (Jest ${jestPackage.version}; Node ${process.version})`;

export const FAILED: Status = "failed";
export const PASSED: Status = "passed";

const defaultConfig: UnflakableConfig = {
  apiBaseUrl: undefined,
  enabled: true,
  failureRetries: 2,
  gitAutoDetect: true,
  quarantineMode: "ignore_failures",
  testSuiteId: undefined,
  uploadResults: true,
};

const loadConfigFile = (searchFrom: string): UnflakableConfig => {
  const configExplorer = cosmiconfigSync("unflakable", {
    searchPlaces: [
      "package.json",
      "unflakable.json",
      "unflakable.js",
      "unflakable.cjs",
      "unflakable.yml",
      "unflakable.yaml",
    ],
  });
  const configResult = configExplorer.search(searchFrom);
  if (configResult !== null) {
    debug(`Loaded config from ${configResult.filepath}`);
    if (typeof configResult.config !== "object") {
      throw new Error(
        `Invalid Unflakable config found at ${
          configResult.filepath
        } -- should be an object, but found ${typeof configResult.config}`
      );
    }

    return Object.entries(
      configResult.config as { [s: string]: unknown }
    ).reduce(
      (result, [key, value]) => {
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
  } else {
    debug("No config file found; using defaults");
    return { ...defaultConfig };
  }
};

export const loadConfig = (searchFrom: string): UnflakableConfig => {
  const config = loadConfigFile(searchFrom);

  if (process.env.UNFLAKABLE_ENABLED !== undefined) {
    const enabled = !["false", "0"].includes(process.env.UNFLAKABLE_ENABLED);
    debug(
      `${
        enabled ? "En" : "Dis"
      }abling Unflakable plugin due to environment variable UNFLAKABLE_ENABLED`
    );
    config.enabled = enabled;
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
    process.env.UNFLAKABLE_API_BASE_URL !== undefined &&
    process.env.UNFLAKABLE_API_BASE_URL !== ""
  ) {
    debug(
      "Overriding API base URL with environment variable UNFLAKABLE_API_BASE_URL: " +
        process.env.UNFLAKABLE_API_BASE_URL
    );
    config.apiBaseUrl = process.env.UNFLAKABLE_API_BASE_URL;
  }

  return config;
};

export const getTestSuiteId = (config: UnflakableConfig): string => {
  if (
    process.env.UNFLAKABLE_SUITE_ID !== undefined &&
    process.env.UNFLAKABLE_SUITE_ID.length > 0
  ) {
    debug(
      `Using suite ID \`${process.env.UNFLAKABLE_SUITE_ID}\` from environment variable UNFLAKABLE_SUITE_ID`
    );
    return process.env.UNFLAKABLE_SUITE_ID;
  } else if (
    config.testSuiteId !== undefined &&
    config.testSuiteId.length > 0
  ) {
    debug(`Using suite ID \`${config.testSuiteId}\` from config file`);
    return config.testSuiteId;
  } else {
    throw new Error(
      "Unflakable test suite ID not found in config file or UNFLAKABLE_SUITE_ID environment " +
        "variable"
    );
  }
};

export const testKey = (assertionResult: AssertionResult): string[] => [
  ...assertionResult.ancestorTitles,
  assertionResult.title,
];

export const groupBy = <T>(
  arr: Array<T>,
  groupFn: (elem: T) => string
): { [key in string]: T[] } => {
  return arr.reduce((grouped, elem) => {
    const group = groupFn(elem);
    if (group in grouped) {
      grouped[group].push(elem);
    } else {
      grouped[group] = [elem];
    }
    return grouped;
  }, {} as { [key in string]: T[] });
};
