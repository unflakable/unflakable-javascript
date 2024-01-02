// Copyright (c) 2022-2024 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("disable upload via config", (done) =>
    integrationTest(
      {
        params: {
          config: {
            uploadResults: false,
          },
          expectResultsToBeUploaded: false,
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));

  it("disable upload via environment", (done) =>
    integrationTest(
      {
        params: {
          envVars: {
            UNFLAKABLE_UPLOAD_RESULTS: "false",
          },
          expectResultsToBeUploaded: false,
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));

  it("enable upload via environment (override config)", (done) =>
    integrationTest(
      {
        params: {
          config: {
            uploadResults: false,
          },
          envVars: {
            UNFLAKABLE_UPLOAD_RESULTS: "true",
          },
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));
});
