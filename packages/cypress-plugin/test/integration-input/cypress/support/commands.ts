// Copyright (c) 2023-2024 Developer Innovations, LLC

/// <reference types="cypress" />

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace Cypress {
  interface Chainable {
    consoleLog(msg: string): Chainable;
  }
}

Cypress.Commands.add("consoleLog", (msg: string) => cy.task("log", msg));
