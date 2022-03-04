// Copyright (c) 2022 Developer Innovations, LLC

module.exports = {
  testEnvironment: "node",

  reporters: ["@unflakable/jest-plugin/dist/reporter"],
  runner: "@unflakable/jest-plugin/dist/runner",

  transform: {
    "^.+\\.[jt]s$": [
      "babel-jest",
      {
        configFile: "../../../../babel.config.js",
      },
    ],
  },

  verbose: true,
};
