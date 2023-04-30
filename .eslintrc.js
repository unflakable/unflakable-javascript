// Copyright (c) 2022-2023 Developer Innovations, LLC

module.exports = {
  env: {
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // Find the tsconfig.json nearest each source file.
    project: true,
  },
  plugins: ["@typescript-eslint", "import"],
  root: true,
  rules: {
    curly: ["error", "all"],
    eqeqeq: ["error", "always"],
    "no-implicit-coercion": ["error"],
    // https://github.com/eslint/eslint/blob/master/docs/rules/no-sequences.md#when-not-to-use-it
    "no-restricted-syntax": ["error", "SequenceExpression"],
    "prefer-const": ["error", { destructuring: "all" }],
    "require-await": ["error"],
    "@typescript-eslint/no-unused-expressions": ["error"],
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "@typescript-eslint/no-use-before-define": ["error", { functions: false }],
    "@typescript-eslint/strict-boolean-expressions": [
      "error",
      {
        allowString: false,
        allowNumber: false,
        allowNullableObject: false,
      },
    ],
    "@typescript-eslint/switch-exhaustiveness-check": ["error"],
  },
  settings: {
    "import/resolver": {
      typescript: true,
      node: true,
    },
  },
};
