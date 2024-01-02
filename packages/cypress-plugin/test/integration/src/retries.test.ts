// Copyright (c) 2023-2024 Developer Innovations, LLC

import {
  defaultSummaryTotals,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  describe.each(["CLI", "config"] as ("CLI" | "config")[])(
    "set failureRetries via %s",
    (mode) => {
      it("failureRetries = 0", (done) =>
        integrationTest(
          {
            params: {
              ...(mode === "CLI"
                ? {
                    cliArgs: ["--failure-retries", "0"],
                  }
                : {
                    config: {
                      failureRetries: 0,
                    },
                  }),
              expectedRetries: 0,
            },
            summaryTotals: {
              ...defaultSummaryTotals,
              // No flaky tests without retries.
              numFlaky: 0,
              numFailing: 8,
            },
          },
          mockBackend,
          done
        ));

      it("failureRetries = 1", (done) =>
        integrationTest(
          {
            params: {
              ...(mode === "CLI"
                ? {
                    cliArgs: ["--failure-retries", "1"],
                  }
                : {
                    config: {
                      failureRetries: 1,
                    },
                  }),
              expectedRetries: 1,
            },
          },
          mockBackend,
          done
        ));

      it("failureRetries = 3", (done) =>
        integrationTest(
          {
            params: {
              ...(mode === "CLI"
                ? {
                    cliArgs: ["--failure-retries", "3"],
                  }
                : {
                    config: {
                      failureRetries: 3,
                    },
                  }),
              expectedRetries: 3,
            },
          },
          mockBackend,
          done
        ));
    }
  );
});
