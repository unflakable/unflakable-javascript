// Copyright (c) 2022-2023 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./common";

integrationTestSuite(() => {
  it("set quarantineMode to ignore_failures explicitly", () =>
    integrationTest({
      params: {
        config: {
          quarantineMode: "ignore_failures",
        },
      },
      expectedExitCode: 1,
      expectedResults: defaultExpectedResults,
    }));
});
