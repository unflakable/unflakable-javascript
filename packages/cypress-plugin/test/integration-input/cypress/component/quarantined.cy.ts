// Copyright (c) 2023-2024 Developer Innovations, LLC

describe("describe block", () => {
  (Cypress.env("SKIP_QUARANTINED") !== undefined ? it.skip : it)(
    "should be quarantined",
    () => {
      throw new Error();
    }
  );
});
