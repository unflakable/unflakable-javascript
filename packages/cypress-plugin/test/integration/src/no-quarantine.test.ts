// Copyright (c) 2023-2024 Developer Innovations, LLC

import {
  defaultSummaryTotals,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it.each(["CLI", "config"] as ("CLI" | "config")[])(
    "set quarantineMode to no_quarantine via %s",
    (mode, done) =>
      integrationTest(
        {
          params: {
            config: {
              quarantineMode: "no_quarantine",
            },
            ...(mode === "CLI"
              ? {
                  cliArgs: ["--quarantine-mode", "no_quarantine"],
                }
              : {
                  config: {
                    quarantineMode: "no_quarantine",
                  },
                }),
            expectQuarantinedTestsToBeQuarantined: false,
          },
          expectedExitCode: 11,
          summaryTotals: {
            ...defaultSummaryTotals,
            numQuarantined: 0,
            numFailing: 8,
            numFlaky: 3,
          },
        },
        mockBackend,
        done
      )
  );
});
