// Copyright (c) 2022-2023 Developer Innovations, LLC

module.exports = {
  clearMocks: true,
  maxWorkers: 2,
  // The /dist path is required until https://github.com/facebook/jest/pull/11961 is fixed, which
  // appears not to be until Jest 28.x.
  reporters: ["@unflakable/jest-plugin/dist/reporter"],
  runner: "@unflakable/jest-plugin/dist/runner",

  // Default changed in Jest 29 (see
  // https://github.com/facebook/jest/blob/94c06ef0aa9b327f3c400610b861e7308b29ee0d/docs/UpgradingToJest29.md).
  snapshotFormat: {
    escapeString: true,
    printBasicPrototype: true,
  },

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
