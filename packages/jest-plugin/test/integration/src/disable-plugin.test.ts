// Copyright (c) 2022-2024 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("disable plugin via config", (done) =>
    integrationTest(
      {
        params: {
          config: {
            enabled: false,
          },
          expectPluginToBeEnabled: false,
        },
        expectedExitCode: 1,
        expectedResults: {
          failedSuites: 5,
          failedTests: 6,
          flakyTests: 0,
          passedSuites: 1,
          passedSuitesWithIndependentFailures: 0,
          passedTests: 2,
          passedTestsWithIndependentFailures: 0,
          quarantinedSuites: 0,
          quarantinedTests: 0,
          skippedSuites: 0,
          skippedTests: 0,
          passedSnapshots: 1,
          failedSnapshots: 0,
          totalSnapshots: 1,
        },
      },
      mockBackend,
      done
    ));

  it("disable plugin via environment", (done) =>
    integrationTest(
      {
        params: {
          envVars: {
            UNFLAKABLE_ENABLED: "false",
          },
          expectPluginToBeEnabled: false,
        },
        expectedExitCode: 1,
        expectedResults: {
          failedSuites: 5,
          failedTests: 6,
          flakyTests: 0,
          passedSuites: 1,
          passedSuitesWithIndependentFailures: 0,
          passedTests: 2,
          passedTestsWithIndependentFailures: 0,
          quarantinedSuites: 0,
          quarantinedTests: 0,
          skippedSuites: 0,
          skippedTests: 0,
          passedSnapshots: 1,
          failedSnapshots: 0,
          totalSnapshots: 1,
        },
      },
      mockBackend,
      done
    ));

  it("enable plugin via environment (override config)", (done) =>
    integrationTest(
      {
        params: {
          config: {
            enabled: false,
          },
          envVars: {
            UNFLAKABLE_ENABLED: "true",
          },
          expectPluginToBeEnabled: true,
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));
});
