// Copyright (c) 2022 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./common";

integrationTestSuite(() => {
  it("set test suite ID via environment", () =>
    integrationTest({
      params: {
        envVars: {
          UNFLAKABLE_SUITE_ID: "MOCK_SUITE_ID_ENV",
        },
        expectedSuiteId: "MOCK_SUITE_ID_ENV",
      },
      expectedExitCode: 1,
      expectedResults: defaultExpectedResults,
    }));

  it("set test suite ID via config", () =>
    integrationTest({
      params: {
        config: {
          testSuiteId: "MOCK_SUITE_ID_CONFIG",
        },
        envVars: {
          UNFLAKABLE_SUITE_ID: undefined,
        },
        expectedSuiteId: "MOCK_SUITE_ID_CONFIG",
      },
      expectedExitCode: 1,
      expectedResults: defaultExpectedResults,
    }));

  it("set test suite ID via environment (override config)", () =>
    integrationTest({
      params: {
        config: {
          testSuiteId: "MOCK_SUITE_ID_CONFIG",
        },
        envVars: {
          UNFLAKABLE_SUITE_ID: "MOCK_SUITE_ID_ENV",
        },
        expectedSuiteId: "MOCK_SUITE_ID_ENV",
      },
      expectedExitCode: 1,
      expectedResults: defaultExpectedResults,
    }));
});
