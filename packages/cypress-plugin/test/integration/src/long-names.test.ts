// Copyright (c) 2023-2024 Developer Innovations, LLC

import {
  defaultSummaryTotals,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";
import { QuarantineMode } from "@unflakable/plugins-common";

integrationTestSuite((mockBackend) => {
  it.each(["ignore_failures", "skip_tests"] as QuarantineMode[])(
    "test names longer than 4096 chars should be truncated w/ quarantineMode = %s",
    (quarantineMode, done) =>
      integrationTest(
        {
          params: {
            config:
              quarantineMode === "skip_tests"
                ? {
                    quarantineMode,
                  }
                : null,
            expectedFlakeTestNameSuffix: "*".repeat(4096),
            expectQuarantinedTestsToBeSkipped: quarantineMode === "skip_tests",
            testEnvVars: {
              FLAKE_TEST_NAME_SUFFIX: "*".repeat(4096),
            },
          },
          summaryTotals:
            quarantineMode === "skip_tests"
              ? {
                  ...defaultSummaryTotals,
                  numPending: 4,
                  numQuarantined: 4,
                }
              : defaultSummaryTotals,
        },
        mockBackend,
        done
      )
  );

  it.each(["ignore_failures", "skip_tests"] as QuarantineMode[])(
    "quarantining should work for tests with names longer than 4096 chars w/ quarantineMode = %s",
    (quarantineMode, done) =>
      integrationTest(
        {
          params: {
            config:
              quarantineMode === "skip_tests"
                ? {
                    quarantineMode,
                  }
                : null,
            expectedFlakeTestNameSuffix: "*".repeat(4096),
            expectQuarantinedTestsToBeSkipped: quarantineMode === "skip_tests",
            testEnvVars: {
              FLAKE_TEST_NAME_SUFFIX: "*".repeat(4096),
            },
            quarantineFlake: true,
          },
          expectedExitCode: 6,
          summaryTotals: {
            ...defaultSummaryTotals,
            numFlaky: 0,
            numPending: quarantineMode === "skip_tests" ? 4 : 5,
            numQuarantined: quarantineMode === "skip_tests" ? 6 : 5,
          },
        },
        mockBackend,
        done
      )
  );
});
