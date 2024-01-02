// Copyright (c) 2022-2024 Developer Innovations, LLC

import { integrationTest, integrationTestSuite } from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("set quarantineMode to no_quarantine", (done) =>
    integrationTest(
      {
        params: {
          config: {
            quarantineMode: "no_quarantine",
          },
          expectQuarantinedTestsToBeQuarantined: false,
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
