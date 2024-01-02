// Copyright (c) 2022-2024 Developer Innovations, LLC

module.exports = {
  setupFilesAfterEnv: ["./src/matchers.ts"],
  testEnvironment: "node",

  transform: {
    "^.+\\.[jt]s$": [
      "babel-jest",
      {
        configFile: "../babel.config.js",
      },
    ],
  },

  // NB: This should be greater than TEST_TIMEOUT_MS used by the watchdog in runTestCase().
  testTimeout: 120000,

  verbose: true,
};
