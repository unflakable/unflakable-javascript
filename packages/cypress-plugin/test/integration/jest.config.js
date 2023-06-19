// Copyright (c) 2023 Developer Innovations, LLC

// NB: We *MUST* run this test suite with --runInBand because running multiple instances of Cypress
// concurrently on the same machine is not supported and runs into a bunch of race conditions that
// cause tests to fail. See https://github.com/cypress-io/cypress/issues/9135 and
// https://github.com/cypress-io/cypress/issues/1426. Using --runInBand ensures that Jest doesn't
// run tests concurrently, which in turn ensures that we don't kick off multiple Cypress instances
// concurrently.

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: "ts-jest",
  setupFilesAfterEnv: ["jest-expect-message", "./src/matchers.ts"],
  testEnvironment: "node",
  // NB: This should be greater than TEST_TIMEOUT_MS used by the watchdog in runTestCase().
  testTimeout: 60000,
  verbose: true,
};
