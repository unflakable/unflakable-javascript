// Copyright (c) 2023-2024 Developer Innovations, LLC

// Import commands.js using CJS syntax:
require("./commands.js");

// We have to use @unflakable/cypress-plugin/dist/skip-tests here due to Cypress depending on
// Webpack 4, which doesn't support sub-path exports. See
// https://github.com/cypress-io/cypress/issues/23826.
const {
  registerMochaInstrumentation,
} = require("@unflakable/cypress-plugin/dist/skip-tests");

registerMochaInstrumentation();
