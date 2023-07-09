// Copyright (c) 2023 Developer Innovations, LLC

import {
  defaultSummaryTotals,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("run should not fail due to error fetching manifest", (done) =>
    integrationTest(
      {
        params: {
          failToFetchManifest: true,
          skipBeforeHook: true,
          skipFailures: true,
          skipFlake: true,
          skipQuarantined: true,
        },
        expectedExitCode: 0,
        summaryTotals: {
          icon: "pass",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 5,
          numPending: 14,
          numQuarantined: 0,
          numSkipped: 0,
          // No error thrown in invalid.cy.ts means Cypress doesn't create a fake test to
          // represent the failure.
          numTests: 19,
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
      },
      mockBackend,
      done
    ));

  it("reporter should print results even if both manifest fetch and upload fail", (done) =>
    integrationTest(
      {
        params: {
          expectQuarantinedTestsToBeQuarantined: false,
          failToFetchManifest: true,
          failToUploadResults: true,
        },
        expectedExitCode: 1,
        summaryTotals: {
          ...defaultSummaryTotals,
          numFailing: 8,
          numFlaky: 3,
          numQuarantined: 0,
        },
      },
      mockBackend,
      done
    ));
});
