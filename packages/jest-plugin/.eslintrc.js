// Copyright (c) 2023-2024 Developer Innovations, LLC

module.exports = {
  extends: ["../../.eslintrc-ts.js"],
  overrides: [
    {
      // Disable some rules that fail for vendored Jest code. If we fix these, it'll be harder to
      // merge upstream changes.
      files: ["src/vendored/**"],
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
