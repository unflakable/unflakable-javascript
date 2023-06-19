// Copyright (c) 2023 Developer Innovations, LLC

Cypress.Commands.add("consoleLog", (msg) => cy.task("log", msg));
