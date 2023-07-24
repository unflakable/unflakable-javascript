// Copyright (c) 2022-2023 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("disable failure retries", (done) =>
    integrationTest(
      {
        params: {
          config: {
            failureRetries: 0,
          },
          expectedFailureRetries: 0,
        },
        expectedExitCode: 1,
        expectedResults: {
          failedSuites: 4,
          failedTests: 4,
          flakyTests: 0,
          passedSuites: 1,
          passedSuitesWithIndependentFailures: 0,
          passedTests: 2,
          passedTestsWithIndependentFailures: 0,
          quarantinedSuites: 1,
          quarantinedTests: 2,
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

  it("set failure retries to 1", (done) =>
    integrationTest(
      {
        params: {
          config: {
            failureRetries: 1,
          },
          expectedFailureRetries: 1,
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));
});
