// Copyright (c) 2023-2024 Developer Innovations, LLC

describe("describe block", () => {
  if (Cypress.env("SKIP_BEFORE_HOOK") === undefined) {
    before("before hook with title", (done: Mocha.Done) => {
      process.nextTick(() => {
        throw new Error("before Error #1");
      });
      if (Cypress.env("MULTIPLE_HOOK_ERRORS") !== undefined) {
        process.nextTick(() => {
          done(new Error("before Error #2"));
        });
      }
    });
  }

  if (Cypress.env("SKIP_BEFORE_EACH_HOOK") === undefined) {
    beforeEach("beforeEach hook with title", (done: Mocha.Done) => {
      process.nextTick(() => {
        throw new Error("beforeEach Error #1");
      });
      if (Cypress.env("MULTIPLE_HOOK_ERRORS") !== undefined) {
        process.nextTick(() => {
          done(new Error("beforeEach Error #2"));
        });
      }
    });
  }

  it("should fail due to hook", () => {
    if (Cypress.env("HOOK_AND_TEST_ERRORS") !== undefined) {
      throw new Error("test error");
    }
  });

  // This test should never run when a before()/beforeEach()/afterEach() hook fails.
  it("should be skipped", () => undefined);

  if (Cypress.env("SKIP_AFTER_EACH_HOOK") === undefined) {
    afterEach("afterEach hook with title", (done: Mocha.Done) => {
      process.nextTick(() => {
        throw new Error("afterEach Error #1");
      });
      if (Cypress.env("MULTIPLE_HOOK_ERRORS") !== undefined) {
        process.nextTick(() => {
          done(new Error("afterEach Error #2"));
        });
      }
    });
  }

  if (Cypress.env("SKIP_AFTER_HOOK") === undefined) {
    after("after hook with title", (done: Mocha.Done) => {
      process.nextTick(() => {
        throw new Error("after Error #1");
      });
      if (Cypress.env("MULTIPLE_HOOK_ERRORS") !== undefined) {
        process.nextTick(() => {
          done(new Error("after Error #2"));
        });
      }
    });
  }
});
