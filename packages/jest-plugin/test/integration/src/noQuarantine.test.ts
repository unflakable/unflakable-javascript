// Copyright (c) 2022-2023 Developer Innovations, LLC

import { integrationTest, integrationTestSuite } from "./common";

integrationTestSuite(() => {
  it("set quarantineMode to no_quarantine", () =>
    integrationTest({
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
