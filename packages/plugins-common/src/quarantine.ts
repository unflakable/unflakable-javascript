// Copyright (c) 2023-2024 Developer Innovations, LLC

// Avoid depending on the core of the js-api, which includes a bunch of Node dependencies. We need
// this module to work in the browser for the Cypress plugin's skip-tests module.
import { TEST_NAME_ENTRY_MAX_LENGTH } from "@unflakable/js-api/consts";
import type { TestSuiteManifest } from "@unflakable/js-api";
import deepEqual from "deep-equal";

// If the last test name entry is too long, truncate it to prevent the backend from
// filtering it out. This allows us to support, for example, long code snippets passed
// to eslint.RuleTester. The downside is that if multiple tests share the same prefix,
// they will be treated as a single test. If one is quarantined, they will all
// effectively be quarantined. Users may avoid this issue by specifying unique (and
// ideally human-friendly) names for each test case rather than using a code snippet
// as the test name.
//
// Note that we do *not* truncate long filenames or test name entries other than the
// last one, nor do we remove test name entries beyond the maximum number of allowed
// entries. Any of these conditions will result in the backend filtering out the
// affected tests.
export const normalizeTestName = (fullTestName: string[]): string[] =>
  fullTestName.length === 0
    ? []
    : [
        ...fullTestName.slice(0, fullTestName.length - 1),
        fullTestName[fullTestName.length - 1].substring(
          0,
          TEST_NAME_ENTRY_MAX_LENGTH
        ),
      ];

export const isTestQuarantined = (
  manifest: TestSuiteManifest,
  posixTestFilename: string,
  fullTestName: string[]
): boolean => {
  const testName = normalizeTestName(fullTestName);
  return manifest.quarantined_tests.some(
    (quarantinedTest) =>
      quarantinedTest.filename === posixTestFilename &&
      deepEqual(quarantinedTest.name, testName)
  );
};
