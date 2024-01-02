// Copyright (c) 2023-2024 Developer Innovations, LLC

/*
let calls = 0;

afterEach(() =>
  cy.task("log", `RUNNING HOOK WITH CALLS=${calls}`).then(() => {
    if (calls++ === 0) {
      return cy
        .task("log", `failing hook`)
        .then(() => Promise.reject(new Error("afterEach failure")));
    } else {
      return;
    }
  })
);
*/

(Cypress.env("SKIP_FLAKE") !== undefined ? it.skip : it)(
  `should be flaky${
    /**
     * @type {string | undefined}
     */
    Cypress.env("FLAKE_TEST_NAME_SUFFIX") ?? ""
  }`,
  () => {
    if (cy.state("test").currentRetry() === 0) {
      throw new Error("first try should fail");
    }
  }
);
