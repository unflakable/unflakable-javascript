// Copyright (c) 2022-2023 Developer Innovations, LLC

import type { AssertionResult, Status } from "@jest/test-result";
import jestPackage from "jest/package.json";
import { normalizeTestName } from "@unflakable/plugins-common";

const JEST_PLUGIN_VERSION: string =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require("../package.json") as { version: string }).version;
export const USER_AGENT = `unflakable-jest-plugin/${JEST_PLUGIN_VERSION} (Jest ${jestPackage.version}; Node ${process.version})`;

export const FAILED: Status = "failed";
export const PASSED: Status = "passed";

export const testKey = (
  assertionResult: AssertionResult,
  normalize = true
): string[] => {
  const fullKey = [...assertionResult.ancestorTitles, assertionResult.title];
  return normalize ? normalizeTestName(fullKey) : fullKey;
};

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
