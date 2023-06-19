// Copyright (c) 2023 Developer Innovations, LLC

require("./commands.js");

const { mount } = require("cypress/react18");

Cypress.Commands.add("mount", mount);

// Example use:
// cy.mount(<MyComponent />)
