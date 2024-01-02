// Copyright (c) 2023-2024 Developer Innovations, LLC

import {
  integrationTestSuite,
  integrationTest,
  defaultSummaryTotals,
} from "./test-wrappers";
import { QuarantineMode } from "@unflakable/plugins-common";

integrationTestSuite((mockBackend) => {
  it("quarantine flaky test", (done) =>
    integrationTest(
      {
        params: {
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

  it("skip failures", (done) =>
    integrationTest(
      {
        params: {
          skipBeforeHook: true,
          skipFailures: true,
        },
        expectedExitCode: 2,
        summaryTotals: {
          ...defaultSummaryTotals,
          numFailing: 0,
          numPassing: 5,
          numPending: 9,
          numSkipped: 0,
          // No error thrown in invalid.cy.ts means Cypress doesn't create a fake test to represent
          // the failure.
          numTests: 19,
        },
      },
      mockBackend,
      done
    ));

  it.each(["ignore_failures", "skip_tests"] as QuarantineMode[])(
    "run should succeed when skipping failures and quarantining flaky test w/ quarantineMode = %s",
    (quarantineMode, done) =>
      integrationTest(
        {
          params: {
            ...(quarantineMode === "skip_tests"
              ? { config: { quarantineMode } }
              : {}),
            expectQuarantinedTestsToBeSkipped: quarantineMode === "skip_tests",
            quarantineFlake: true,
            skipBeforeHook: true,
            skipFailures: true,
          },
          expectedExitCode: 0,
          summaryTotals: {
            icon: "pass",
            numFailing: 0,
            numFlaky: 0,
            numPassing: 5,
            numPending: quarantineMode === "skip_tests" ? 8 : 9,
            // Quarantined tests skipped via explicit it.skip() are indistinguishable from
            // quarantined tests skipped due to skip_tests (which uses it.skip()).
            numQuarantined: quarantineMode === "skip_tests" ? 6 : 5,
            numSkipped: 0,
            // No error thrown in invalid.cy.ts means Cypress doesn't create a fake test to
            // represent the failure.
            numTests: 19,
          },
        },
        mockBackend,
        done
      )
  );
});
