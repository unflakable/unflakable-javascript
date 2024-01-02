// Copyright (c) 2023-2024 Developer Innovations, LLC

// Import commands.js using CJS syntax:
require("./commands.js");

const {
  registerMochaInstrumentation,
} = require("@unflakable/cypress-plugin/skip-tests");

registerMochaInstrumentation();
