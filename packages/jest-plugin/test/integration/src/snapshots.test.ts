// Copyright (c) 2022-2024 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("use snapshot tests", (done) =>
    integrationTest(
      {
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
      },
      mockBackend,
      done
    ));
});
