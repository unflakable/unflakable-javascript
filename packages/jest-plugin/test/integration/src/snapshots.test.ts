// Copyright (c) 2022 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./common";

integrationTestSuite(() => {
  it("use snapshot tests", () =>
    integrationTest({
      params: {
        envVars: {
          TEST_SNAPSHOTS: "true",
        },
        expectSnapshots: true,
      },
      expectedExitCode: 1,
      expectedResults: {
        ...defaultExpectedResults,
        passedSnapshots: 1,
        failedSnapshots: 4,
        totalSnapshots: 5,
      },
    }));
});
