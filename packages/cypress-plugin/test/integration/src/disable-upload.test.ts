// Copyright (c) 2023-2024 Developer Innovations, LLC

import { integrationTest, integrationTestSuite } from "./test-wrappers";

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
      },
      mockBackend,
      done
    ));

  it("disable upload via CLI", (done) =>
    integrationTest(
      {
        params: {
          cliArgs: ["--no-upload-results"],
          envVars: {
            // Make sure CLI arg overrides environment variable and config.
            UNFLAKABLE_UPLOAD_RESULTS: "true",
          },
          expectResultsToBeUploaded: false,
        },
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
      },
      mockBackend,
      done
    ));
});
