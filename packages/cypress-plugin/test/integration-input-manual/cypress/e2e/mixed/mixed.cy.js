// Copyright (c) 2023-2024 Developer Innovations, LLC

describe("spec with mixed test results", () => {
  const quarantinedTestFn =
    Cypress.env("SKIP_QUARANTINED") !== undefined ? it.skip : it;

  quarantinedTestFn("mixed: failure should be quarantined", () => {
    throw new Error();
  });

  quarantinedTestFn("mixed: flake should be quarantined", () => {
    if (cy.state("test").currentRetry() === 0) {
      throw new Error("first try should fail");
    }
  });

  (Cypress.env("SKIP_FAILURES") !== undefined ? it.skip : it)(
    "mixed: should fail",
    () => {
      throw new Error();
    }
  );

  (Cypress.env("SKIP_FLAKE") !== undefined ? it.skip : it)(
    "mixed: should be flaky",
    () => {
      if (cy.state("test").currentRetry() === 0) {
        throw new Error("first try should fail");
      }
    }
  );

  it("mixed: should pass", () => undefined);

  it.skip("mixed: should be skipped", () => undefined);
});
