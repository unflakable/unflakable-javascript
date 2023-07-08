// Copyright (c) 2022-2023 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("test names longer than 4096 chars should be truncated", (done) =>
    integrationTest(
      {
        params: {
          expectedFlakeTestNameSuffix: "*".repeat(4096),
          envVars: {
            FLAKE_TEST_NAME_SUFFIX: "*".repeat(4096),
          },
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));

  // Include an emoji here for good measure for our dogfooding.
  it("quarantining should work for tests with names longer than 4096 chars 😅", (done) =>
    integrationTest(
      {
        params: {
          expectedFlakeTestNameSuffix: "*".repeat(4096),
          envVars: {
            FLAKE_TEST_NAME_SUFFIX: "*".repeat(4096),
          },
          quarantineFlake: true,
        },
        expectedExitCode: 1,
        expectedResults: {
          failedSuites: 3,
          failedTests: 2,
          flakyTests: 0,
          passedSuites: 1,
          passedTests: 2,
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
});
