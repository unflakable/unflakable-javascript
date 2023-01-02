// Copyright (c) 2022-2023 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./common";

integrationTestSuite(() => {
  it("use --testNamePattern to have Jest filter tests", () =>
    integrationTest({
      params: {
        testNamePattern: "(should .*fail|should be flaky)",
      },
      expectedExitCode: 1,
      expectedResults: {
        failedSuites: 4,
        failedTests: 2,
        flakyTests: 2,
        passedSuites: 0,
        passedTests: 0,
        quarantinedSuites: 0,
        quarantinedTests: 0,
        skippedSuites: 2,
        skippedTests: 4,
        passedSnapshots: 0,
        failedSnapshots: 0,
        totalSnapshots: 0,
      },
    }));

  it("use --testNamePattern with no matches", () =>
    integrationTest({
      params: {
        skipFailures: true,
        testNamePattern: "no matches",
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

  it("use a permissive --testNamePattern and ensure only failed tests are retried", () =>
    integrationTest({
      params: {
        testNamePattern: ".*",
      },
      expectedExitCode: 1,
      expectedResults: defaultExpectedResults,
    }));

  it("use --testNamePattern with plugin disabled", () =>
    integrationTest({
      params: {
        envVars: {
          UNFLAKABLE_ENABLED: "false",
        },
        expectPluginToBeEnabled: false,
        testNamePattern: "(should .*fail|should be flaky)",
      },
      expectedExitCode: 1,
      expectedResults: {
        failedSuites: 4,
        failedTests: 4,
        flakyTests: 0,
        passedSuites: 0,
        passedTests: 0,
        quarantinedSuites: 0,
        quarantinedTests: 0,
        skippedSuites: 2,
        skippedTests: 4,
        passedSnapshots: 0,
        failedSnapshots: 0,
        totalSnapshots: 0,
      },
    }));
});
