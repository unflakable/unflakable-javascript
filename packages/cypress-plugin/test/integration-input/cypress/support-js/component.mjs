// Copyright (c) 2023-2024 Developer Innovations, LLC

// Import commands.js using ES2015 syntax:
import "./commands.js";

import { mount } from "cypress/react18";

Cypress.Commands.add("mount", mount);

// Example use:
// cy.mount(<MyComponent />)
