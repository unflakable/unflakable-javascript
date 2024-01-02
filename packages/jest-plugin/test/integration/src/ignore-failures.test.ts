// Copyright (c) 2022-2024 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("set quarantineMode to ignore_failures explicitly", (done) =>
    integrationTest(
      {
        params: {
          config: {
            quarantineMode: "ignore_failures",
          },
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));
});
