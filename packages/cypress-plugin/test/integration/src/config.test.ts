// Copyright (c) 2023 Developer Innovations, LLC

import { integrationTestSuite, integrationTest } from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("set test suite ID via config", (done) =>
    integrationTest(
      {
        params: {
          config: {
            testSuiteId: "MOCK_SUITE_ID_CONFIG",
          },
          envVars: {
            UNFLAKABLE_SUITE_ID: undefined,
          },
          expectedSuiteId: "MOCK_SUITE_ID_CONFIG",
        },
      },
      mockBackend,
      done
    ));

  it("set test suite ID via environment", (done) =>
    integrationTest(
      {
        params: {
          config: {
            testSuiteId: "MOCK_SUITE_ID_CONFIG",
          },
          envVars: {
            UNFLAKABLE_SUITE_ID: "MOCK_SUITE_ID_ENV",
          },
          // Environment should take precedent over config.
          expectedSuiteId: "MOCK_SUITE_ID_ENV",
        },
      },
      mockBackend,
      done
    ));

  it("set test suite ID via CLI", (done) =>
    integrationTest(
      {
        params: {
          cliArgs: ["--test-suite-id", "MOCK_SUITE_ID_CLI"],
          envVars: {
            UNFLAKABLE_SUITE_ID: undefined,
          },
          expectedSuiteId: "MOCK_SUITE_ID_CLI",
        },
      },
      mockBackend,
      done
    ));

  it("set test suite ID via CLI override", (done) =>
    integrationTest(
      {
        params: {
          cliArgs: ["--test-suite-id", "MOCK_SUITE_ID_CLI"],
          config: {
            testSuiteId: "MOCK_SUITE_ID_CONFIG",
          },
          envVars: {
            UNFLAKABLE_SUITE_ID: "MOCK_SUITE_ID_ENV",
          },
          // CLI should take precedent over environment and config.
          expectedSuiteId: "MOCK_SUITE_ID_CLI",
        },
      },
      mockBackend,
      done
    ));
});
