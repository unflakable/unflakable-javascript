// Copyright (c) 2022-2023 Developer Innovations, LLC

module.exports = {
  clearMocks: true,
  // maxWorkers: 2,

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
        configFile: "../babel.config.js",
      },
    ],
  },

  verbose: true,
};
