// Copyright (c) 2022 Developer Innovations, LLC

module.exports = {
  clearMocks: true,
  maxWorkers: 2,
  // The /dist path is required until https://github.com/facebook/jest/pull/11961 is fixed, which
  // appears not to be until Jest 28.x.
  reporters: ["@unflakable/jest-plugin/dist/reporter"],
  runner: "@unflakable/jest-plugin/dist/runner",

  testEnvironment: "node",

  transform: {
    "^.+\\.[jt]sx?$": [
      "babel-jest",
      {
        configFile: "../../../../babel.config.js",
      },
    ],
  },

  verbose: true,
};
