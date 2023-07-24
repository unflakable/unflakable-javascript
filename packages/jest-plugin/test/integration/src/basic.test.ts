// Copyright (c) 2022-2023 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("environment variables config + git auto-detect", (done) =>
    integrationTest(
      {
        params: {},
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));

  it("quarantine flaky test", (done) =>
    integrationTest(
      {
        params: {
          quarantineFlake: true,
        },
        expectedExitCode: 1,
        expectedResults: {
          failedSuites: 3,
          failedTests: 2,
          flakyTests: 0,
          passedSuites: 1,
          passedSuitesWithIndependentFailures: 0,
          passedTests: 2,
          passedTestsWithIndependentFailures: 0,
          quarantinedSuites: 2,
          quarantinedTests: 4,
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

  it("skip failures", (done) =>
    integrationTest(
      {
        params: {
          skipFailures: true,
        },
        expectedExitCode: 1,
        expectedResults: {
          failedSuites: 1,
          failedTests: 0,
          flakyTests: 2,
          passedSuites: 1,
          passedSuitesWithIndependentFailures: 0,
          passedTests: 2,
          passedTestsWithIndependentFailures: 0,
          quarantinedSuites: 2,
          quarantinedTests: 2,
          skippedSuites: 1,
          skippedTests: 2,
          passedSnapshots: 1,
          failedSnapshots: 0,
          totalSnapshots: 1,
        },
      },
      mockBackend,
      done
    ));

  it("run should succeed when skipping failures and quarantining flaky test", (done) =>
    integrationTest(
      {
        params: {
          quarantineFlake: true,
          skipFailures: true,
        },
        expectedExitCode: 0,
        expectedResults: {
          failedSuites: 0,
          failedTests: 0,
          flakyTests: 0,
          passedSuites: 1,
          passedSuitesWithIndependentFailures: 0,
          passedTests: 2,
          passedTestsWithIndependentFailures: 0,
          quarantinedSuites: 3,
          quarantinedTests: 4,
          skippedSuites: 1,
          skippedTests: 2,
          passedSnapshots: 1,
          failedSnapshots: 0,
          totalSnapshots: 1,
        },
      },
      mockBackend,
      done
    ));
});
