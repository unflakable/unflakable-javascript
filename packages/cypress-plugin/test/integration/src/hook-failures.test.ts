// Copyright (c) 2023-2024 Developer Innovations, LLC

import { integrationTest, integrationTestSuite } from "./test-wrappers";
import semverLt from "semver/functions/lt";
import cypressPackage from "cypress/package.json";

// Cypress 13.4 broke the handling of multiple hook failures. Prior to that version, Cypress/Mocha
// reported both errors as failures of the first test in the suite, and then skipped all remaining
// tests. Beginning in 13.4, Cypress skips all tests in the suite and never reports either error.
// This was most likely introduced in https://github.com/cypress-io/cypress/pull/27930.
const supportMultipleHookErrors = semverLt(cypressPackage.version, "13.4.0");

integrationTestSuite((mockBackend) => {
  it("run should succeed when before() fails and both tests are quarantined", (done) =>
    integrationTest(
      {
        params: {
          quarantineHookFail: true,
          quarantineHookSkip: true,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 0,
        summaryTotals: {
          icon: "pass",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 1,
          numSkipped: 1,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("run should succeed when beforeEach() fails and both tests are quarantined", (done) =>
    integrationTest(
      {
        params: {
          skipBeforeHook: true,
          skipBeforeEachHook: false,
          quarantineHookFail: true,
          quarantineHookSkip: true,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 0,
        summaryTotals: {
          icon: "pass",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 1,
          numSkipped: 1,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("run should succeed when afterEach() fails and both tests are quarantined", (done) =>
    integrationTest(
      {
        params: {
          skipBeforeHook: true,
          skipAfterEachHook: false,
          quarantineHookFail: true,
          quarantineHookSkip: true,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 0,
        summaryTotals: {
          icon: "pass",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 1,
          numSkipped: 1,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("run should fail when non-quarantined test is skipped", (done) =>
    integrationTest(
      {
        params: {
          quarantineHookFail: true,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 1,
        summaryTotals: {
          icon: "fail",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 1,
          numSkipped: 1,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("failed beforeEach() hook", (done) =>
    integrationTest(
      {
        params: {
          skipBeforeHook: true,
          skipBeforeEachHook: false,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 1,
        summaryTotals: {
          icon: "fail",
          numFailing: 1,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 0,
          numSkipped: 1,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("failed afterEach() hook", (done) =>
    integrationTest(
      {
        params: {
          skipBeforeHook: true,
          skipAfterEachHook: false,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 1,
        summaryTotals: {
          icon: "fail",
          numFailing: 1,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 0,
          numSkipped: 1,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("failed after() hook", (done) =>
    integrationTest(
      {
        params: {
          skipBeforeHook: true,
          skipAfterHook: false,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 1,
        summaryTotals: {
          icon: "fail",
          numFailing: 1,
          numFlaky: 0,
          numPassing: 1,
          numPending: 0,
          numQuarantined: 0,
          numSkipped: 0,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("run should succeed with failed after() and quarantined test", (done) =>
    integrationTest(
      {
        params: {
          skipBeforeHook: true,
          skipAfterHook: false,
          quarantineHookSkip: true,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 0,
        summaryTotals: {
          icon: "pass",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 1,
          numPending: 0,
          numQuarantined: 1,
          numSkipped: 0,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("failed beforeEach() and after() hooks", (done) =>
    integrationTest(
      {
        params: {
          skipBeforeHook: true,
          skipBeforeEachHook: false,
          skipAfterHook: false,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 2,
        summaryTotals: {
          icon: "fail",
          numFailing: 2,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 0,
          numSkipped: 0,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("run should succeed when beforeEach() and after() hooks fail and tests are both quarantined", (done) =>
    integrationTest(
      {
        params: {
          quarantineHookFail: true,
          quarantineHookSkip: true,
          skipBeforeHook: true,
          skipBeforeEachHook: false,
          skipAfterHook: false,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 0,
        summaryTotals: {
          icon: "pass",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 2,
          numSkipped: 0,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("failed afterEach() and after() hooks", (done) =>
    integrationTest(
      {
        params: {
          skipBeforeHook: true,
          skipAfterHook: false,
          skipAfterEachHook: false,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 2,
        summaryTotals: {
          icon: "fail",
          numFailing: 2,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 0,
          numSkipped: 0,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("run should succeed when afterEach() and after() hooks fail and tests are both quarantined", (done) =>
    integrationTest(
      {
        params: {
          quarantineHookFail: true,
          quarantineHookSkip: true,
          skipBeforeHook: true,
          skipAfterHook: false,
          skipAfterEachHook: false,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 0,
        summaryTotals: {
          icon: "pass",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 2,
          numSkipped: 0,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  (supportMultipleHookErrors ? it : it.skip)(
    "multiple before() hook errors",
    (done) =>
      integrationTest(
        {
          params: {
            multipleHookErrors: true,
            specNameStubs: ["hook-fail"],
          },
          expectedExitCode: 1,
          summaryTotals: {
            icon: "fail",
            numFailing: 1,
            numFlaky: 0,
            numPassing: 0,
            numPending: 0,
            numQuarantined: 0,
            numSkipped: 1,
            numTests: 2,
          },
        },
        mockBackend,
        done
      )
  );

  it("test and afterEach() hook errors", (done) =>
    integrationTest(
      {
        params: {
          hookAndTestErrors: true,
          skipBeforeHook: true,
          skipAfterEachHook: false,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 1,
        summaryTotals: {
          icon: "fail",
          numFailing: 1,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 0,
          numSkipped: 1,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));

  it("test and after() hook errors", (done) =>
    integrationTest(
      {
        params: {
          hookAndTestErrors: true,
          skipBeforeHook: true,
          skipAfterHook: false,
          specNameStubs: ["hook-fail"],
        },
        expectedExitCode: 2,
        summaryTotals: {
          icon: "fail",
          numFailing: 2,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 0,
          numSkipped: 0,
          numTests: 2,
        },
      },
      mockBackend,
      done
    ));
});
