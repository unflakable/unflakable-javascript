// Copyright (c) 2022-2023 Developer Innovations, LLC

import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./common";

integrationTestSuite(() => {
  it("disable upload via config", () =>
    integrationTest({
      params: {
        config: {
          uploadResults: false,
        },
        expectResultsToBeUploaded: false,
      },
      expectedExitCode: 1,
      expectedResults: defaultExpectedResults,
    }));

  it("disable upload via environment", () =>
    integrationTest({
      params: {
        envVars: {
          UNFLAKABLE_UPLOAD_RESULTS: "false",
        },
        expectResultsToBeUploaded: false,
      },
      expectedExitCode: 1,
      expectedResults: defaultExpectedResults,
    }));

  it("enable upload via environment (override config)", () =>
    integrationTest({
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
    }));
});
