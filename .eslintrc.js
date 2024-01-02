// Copyright (c) 2022-2024 Developer Innovations, LLC

module.exports = {
  env: {
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
  ],
  parserOptions: {
    // Support `??` operator.
    ecmaVersion: 2020,
  },
  plugins: ["import"],
  root: true,
  rules: {
    curly: ["error", "all"],
    eqeqeq: ["error", "always"],
    "no-implicit-coercion": ["error"],
    // https://github.com/eslint/eslint/blob/master/docs/rules/no-sequences.md#when-not-to-use-it
    "no-restricted-syntax": ["error", "SequenceExpression"],
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "prefer-const": ["error", { destructuring: "all" }],
    "require-await": ["error"],
  },
  settings: {
    "import/resolver": {
      node: true,
    },
  },
};
