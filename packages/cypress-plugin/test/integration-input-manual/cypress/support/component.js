// Copyright (c) 2023-2024 Developer Innovations, LLC

require("./commands");

const { mount } = require("cypress/react18");

Cypress.Commands.add("mount", mount);

// Example use:
// cy.mount(<MyComponent />)

const {
  registerMochaInstrumentation,
} = require("@unflakable/cypress-plugin/skip-tests");

registerMochaInstrumentation();
