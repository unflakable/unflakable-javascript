// Copyright (c) 2023-2024 Developer Innovations, LLC

// Import commands.js using ES2015 syntax:
import "./commands";

import { mount } from "cypress/react18";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
    }
  }
}

Cypress.Commands.add("mount", mount);

// Example use:
// cy.mount(<MyComponent />)
