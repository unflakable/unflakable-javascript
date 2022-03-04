// Copyright (c) 2022 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./common";

integrationTestSuite(() => {
  it("disable plugin via config", () =>
    integrationTest({
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
        passedTests: 2,
        quarantinedSuites: 0,
        quarantinedTests: 0,
        skippedSuites: 0,
        skippedTests: 0,
        passedSnapshots: 1,
        failedSnapshots: 0,
        totalSnapshots: 1,
      },
    }));

  it("disable plugin via environment", () =>
    integrationTest({
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
        passedTests: 2,
        quarantinedSuites: 0,
        quarantinedTests: 0,
        skippedSuites: 0,
        skippedTests: 0,
        passedSnapshots: 1,
        failedSnapshots: 0,
        totalSnapshots: 1,
      },
    }));

  it("enable plugin via environment (override config)", () =>
    integrationTest({
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
    }));
});
