// Copyright (c) 2023-2024 Developer Innovations, LLC

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  extensionsToTreatAsEsm: [".ts"],
  roots: ["src"],
  testEnvironment: "node",
  testTimeout: 60000,
  transform: {
    "^.+\\.[tj]s$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  verbose: true,
};
