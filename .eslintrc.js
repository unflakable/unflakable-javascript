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
    project: "tsconfig.json",
  },
  plugins: ["@typescript-eslint", "jest", "import"],
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
  overrides: [
    {
      // Disable some rules that fail for vendored Jest code. If we fix these, it'll be harder to
      // merge upstream changes.
      files: ["packages/jest-plugin/src/vendored/**/*.ts"],
      rules: {
        "@typescript-eslint/no-inferrable-types": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-var-requires": "off",
        "@typescript-eslint/restrict-plus-operands": "off",
        "@typescript-eslint/strict-boolean-expressions": "off",
        "@typescript-eslint/unbound-method": "off",
      },
    },
  ],
};
