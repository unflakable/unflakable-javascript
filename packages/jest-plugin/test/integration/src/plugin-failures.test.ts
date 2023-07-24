// Copyright (c) 2022-2023 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("run should not fail due to error fetching manifest", (done) =>
    integrationTest(
      {
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
          passedSuitesWithIndependentFailures: 0,
          passedTests: 2,
          passedTestsWithIndependentFailures: 0,
          quarantinedSuites: 0,
          quarantinedTests: 0,
          skippedSuites: 3,
          skippedTests: 6,
          passedSnapshots: 0,
          failedSnapshots: 0,
          totalSnapshots: 0,
        },
      },
      mockBackend,
      done
    ));

  it("reporter should print results even if upload fails", (done) =>
    integrationTest(
      {
        params: {
          failToUploadResults: true,
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));

  it("reporter should print results even if both manifest fetch and upload fail", (done) =>
    integrationTest(
      {
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
});
