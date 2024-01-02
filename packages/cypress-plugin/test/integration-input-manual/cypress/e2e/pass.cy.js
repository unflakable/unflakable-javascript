// Copyright (c) 2023-2024 Developer Innovations, LLC

it("should pass", () => {
  // Make sure the project's support file works even when skip_tests generates a temporary one on
  // the fly.
  cy.consoleLog("called consoleLog command");
});

describe("suite name", () => {
  it("suite test should pass", () => undefined);
});
