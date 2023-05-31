// Copyright (c) 2022-2023 Developer Innovations, LLC

import { integrationTest, integrationTestSuite } from "./common";

integrationTestSuite(() => {
  it("set quarantineMode to skip_tests", () =>
    integrationTest({
      params: {
        config: {
          quarantineMode: "skip_tests",
        },
        expectQuarantinedTestsToBeSkipped: true,
      },
      expectedExitCode: 1,
      expectedResults: {
        failedSuites: 4,
        failedTests: 2,
        flakyTests: 2,
        passedSuites: 1,
        passedTests: 2,
        quarantinedSuites: 0,
        quarantinedTests: 0,
        skippedSuites: 1,
        skippedTests: 2,
        passedSnapshots: 0,
        failedSnapshots: 0,
        totalSnapshots: 0,
      },
    }));

  it("test names longer than 4096 chars should be truncated w/ quarantineMode set to skip_tests", () =>
    integrationTest({
      params: {
        config: {
          quarantineMode: "skip_tests",
        },
        envVars: {
          FLAKE_TEST_NAME_SUFFIX: "*".repeat(4096),
        },
        expectedFlakeTestNameSuffix: "*".repeat(4096),
        expectQuarantinedTestsToBeSkipped: true,
      },
      expectedExitCode: 1,
      expectedResults: {
        failedSuites: 4,
        failedTests: 2,
        flakyTests: 2,
        passedSuites: 1,
        passedTests: 2,
        quarantinedSuites: 0,
        quarantinedTests: 0,
        skippedSuites: 1,
        skippedTests: 2,
        passedSnapshots: 0,
        failedSnapshots: 0,
        totalSnapshots: 0,
      },
    }));

  it("quarantining should work for tests with names longer than 4096 chars w/ quarantineMode set to skip_tests", () =>
    integrationTest({
      params: {
        config: {
          quarantineMode: "skip_tests",
        },
        envVars: {
          FLAKE_TEST_NAME_SUFFIX: "*".repeat(4096),
        },
        expectedFlakeTestNameSuffix: "*".repeat(4096),
        expectQuarantinedTestsToBeSkipped: true,
        quarantineFlake: true,
      },
      expectedExitCode: 1,
      expectedResults: {
        failedSuites: 3,
        failedTests: 2,
        flakyTests: 0,
        passedSuites: 1,
        passedTests: 2,
        quarantinedSuites: 0,
        quarantinedTests: 0,
        skippedSuites: 2,
        skippedTests: 4,
        passedSnapshots: 0,
        failedSnapshots: 0,
        totalSnapshots: 0,
      },
    }));

  it("set quarantineMode to skip_tests and --testNamePattern that skips all other tests", () =>
    integrationTest({
      params: {
        config: {
          quarantineMode: "skip_tests",
        },
        expectQuarantinedTestsToBeSkipped: true,
        expectResultsToBeUploaded: false,
        skipFailures: true,
        testNamePattern: "should be quarantined",
      },
      expectedExitCode: 0,
      expectedResults: {
        failedSuites: 0,
        failedTests: 0,
        flakyTests: 0,
        passedSuites: 0,
        passedTests: 0,
        quarantinedSuites: 0,
        quarantinedTests: 0,
        skippedSuites: 5,
        skippedTests: 8,
        passedSnapshots: 0,
        failedSnapshots: 0,
        totalSnapshots: 0,
      },
    }));
});
