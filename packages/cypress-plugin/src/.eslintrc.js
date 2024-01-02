// Copyright (c) 2023-2024 Developer Innovations, LLC

module.exports = {
  extends: ["../../../.eslintrc-ts.js"],
  overrides: [
    {
      // Disable some rules that fail for vendored Cypress code. If we fix these, it'll be harder to
      // merge upstream changes.
      files: ["vendored/**"],
      rules: {
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unsafe-assignment": "off",
        "@typescript-eslint/no-unsafe-argument": "off",
        "@typescript-eslint/no-unsafe-call": "off",
        "@typescript-eslint/no-unsafe-member-access": "off",
        "@typescript-eslint/no-unsafe-return": "off",
        "@typescript-eslint/no-unused-vars": "off",
        "@typescript-eslint/restrict-template-expressions": "off",
        "@typescript-eslint/strict-boolean-expressions": "off",
        curly: "off",
        eqeqeq: "off",
        "prefer-const": "off",
      },
    },
  ],
};
