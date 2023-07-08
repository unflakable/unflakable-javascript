// Copyright (c) 2022-2023 Developer Innovations, LLC

module.exports = {
  testEnvironment: "node",

  transform: {
    "^.+\\.[jt]s$": [
      "babel-jest",
      {
        configFile: "../../../../babel.config.js",
      },
    ],
  },

  // NB: This should be greater than TEST_TIMEOUT_MS used by the watchdog in runTestCase().
  testTimeout: 40000,

  verbose: true,
};
