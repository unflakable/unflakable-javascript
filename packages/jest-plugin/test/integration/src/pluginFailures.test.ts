// Copyright (c) 2022 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./common";

integrationTestSuite(() => {
  it("run should not fail due to error fetching manifest", () =>
    integrationTest({
      params: {
        failToFetchManifest: true,
        skipFailures: true,
        skipFlake: true,
        skipQuarantined: true,
      },
      expectedExitCode: 0,
      expectedResults: {
        failedSuites: 0,
        failedTests: 0,
        flakyTests: 0,
        passedSuites: 2,
        passedTests: 2,
        quarantinedSuites: 0,
        quarantinedTests: 0,
        skippedSuites: 3,
        skippedTests: 6,
        passedSnapshots: 0,
        failedSnapshots: 0,
        totalSnapshots: 0,
      },
    }));

  it("reporter should print results even if upload fails", () =>
    integrationTest({
      params: {
        failToUploadResults: true,
      },
      expectedExitCode: 1,
      expectedResults: defaultExpectedResults,
    }));

  it("reporter should print results even if both manifest fetch and upload fail", () =>
    integrationTest({
      params: {
        failToFetchManifest: true,
        failToUploadResults: true,
      },
      expectedExitCode: 1,
      expectedResults: {
        failedSuites: 5,
        failedTests: 4,
        flakyTests: 2,
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
});
