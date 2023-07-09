// Copyright (c) 2023 Developer Innovations, LLC

import {
  defaultSummaryTotals,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("emoji test names should be allowed", (done) =>
    integrationTest(
      {
        params: {
          expectedFlakeTestNameSuffix: "🔥🔥🔥",
          testEnvVars: {
            FLAKE_TEST_NAME_SUFFIX: "🔥🔥🔥",
          },
        },
      },
      mockBackend,
      done
    ));

  it("emoji test names should support quarantining", (done) =>
    integrationTest(
      {
        params: {
          expectedFlakeTestNameSuffix: "🔥🔥🔥",
          testEnvVars: {
            FLAKE_TEST_NAME_SUFFIX: "🔥🔥🔥",
          },
          quarantineFlake: true,
        },
        expectedExitCode: 6,
        summaryTotals: {
          ...defaultSummaryTotals,
          numFlaky: 0,
          numQuarantined: 5,
        },
      },
      mockBackend,
      done
    ));
});
