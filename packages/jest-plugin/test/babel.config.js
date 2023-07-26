// Copyright (c) 2022-2023 Developer Innovations, LLC

/* eslint-env node */

/** @type {import('@babel/core').ConfigFunction} */
module.exports = (api) => {
  api.cache.using(() => process.env.NODE_ENV);
  return {
    presets: [
      "@babel/preset-typescript",
      // `@babel/preset-env` is used to transpile ES modules to Common JS for
      // consumption by Jest during tests:
      ...(process.env.NODE_ENV === "test"
        ? [
            [
              "@babel/preset-env",
              {
                targets: {
                  node: "current",
                },
              },
            ],
          ]
        : []),
    ],
  };
};
