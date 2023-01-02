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

  verbose: true,
};
