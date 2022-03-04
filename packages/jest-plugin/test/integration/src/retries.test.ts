// Copyright (c) 2022 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./common";

integrationTestSuite(() => {
  it("disable failure retries", () =>
    integrationTest({
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
        passedTests: 2,
        quarantinedSuites: 1,
        quarantinedTests: 2,
        skippedSuites: 0,
        skippedTests: 0,
        passedSnapshots: 1,
        failedSnapshots: 0,
        totalSnapshots: 1,
      },
    }));

  it("set failure retries to 1", () =>
    integrationTest({
      params: {
        config: {
          failureRetries: 1,
        },
        expectedFailureRetries: 1,
      },
      expectedExitCode: 1,
      expectedResults: defaultExpectedResults,
    }));
});
