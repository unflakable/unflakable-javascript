// Copyright (c) 2023 Developer Innovations, LLC

describe("describe block", () => {
  (Cypress.env("SKIP_QUARANTINED") !== undefined ? it.skip : it)(
    "should be quarantined",
    () => {
      throw new Error();
    }
  );
});
