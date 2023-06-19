// Copyright (c) 2023 Developer Innovations, LLC

import {
  defaultSummaryTotals,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite(() => {
  const expectedExitCodeWithPluginDisabled = 11;
  const summaryTotalsWithPluginDisabled = {
    ...defaultSummaryTotals,
    numQuarantined: 0,
    numFlaky: 0,
    numFailing: 11,
  };

  it("disable plugin via config", (done) =>
    integrationTest(
      {
        params: {
          config: {
            enabled: false,
          },
          expectPluginToBeEnabled: false,
        },
        expectedExitCode: expectedExitCodeWithPluginDisabled,
        summaryTotals: summaryTotalsWithPluginDisabled,
      },
      done
    ));

  it("disable plugin via environment", (done) =>
    integrationTest(
      {
        params: {
          envVars: {
            UNFLAKABLE_ENABLED: "false",
          },
          expectPluginToBeEnabled: false,
        },
        expectedExitCode: expectedExitCodeWithPluginDisabled,
        summaryTotals: summaryTotalsWithPluginDisabled,
      },
      done
    ));

  it("enable plugin via environment (override config)", (done) =>
    integrationTest(
      {
        params: {
          config: {
            enabled: false,
          },
          envVars: {
            UNFLAKABLE_ENABLED: "true",
          },
        },
      },
      done
    ));
});
