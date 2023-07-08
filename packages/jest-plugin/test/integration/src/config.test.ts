// Copyright (c) 2022-2023 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("set test suite ID via environment", (done) =>
    integrationTest(
      {
        params: {
          envVars: {
            UNFLAKABLE_SUITE_ID: "MOCK_SUITE_ID_ENV",
          },
          expectedSuiteId: "MOCK_SUITE_ID_ENV",
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));

  it("set test suite ID via config", (done) =>
    integrationTest(
      {
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
      },
      mockBackend,
      done
    ));

  it("set test suite ID via environment (override config)", (done) =>
    integrationTest(
      {
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
      },
      mockBackend,
      done
    ));
});
