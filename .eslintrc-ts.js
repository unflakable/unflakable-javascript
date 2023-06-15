// Copyright (c) 2022-2023 Developer Innovations, LLC

module.exports = {
  extends: [
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "plugin:import/typescript",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    // Find the tsconfig.json nearest each source file.
    project: true,
  },
  plugins: ["@typescript-eslint"],
  rules: {
    "@typescript-eslint/explicit-function-return-type": ["error"],
    "@typescript-eslint/explicit-module-boundary-types": ["error"],
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
      files: ["**/*.js", "**/*.cjs", "**/*.mjs"],
      rules: {
        // JS files don't have explicit types, and this lint rule fails even if they have doc
        // comment type annotations.
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",
        // Allow require() in JS files (most of which are CommonJS, not ESM).
        "@typescript-eslint/no-var-requires": "off",
      },
    },
  ],
  settings: {
    "import/resolver": {
      typescript: true,
    },
  },
};
