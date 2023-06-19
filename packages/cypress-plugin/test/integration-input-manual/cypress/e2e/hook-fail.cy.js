// Copyright (c) 2023 Developer Innovations, LLC

describe("describe block", () => {
  if (Cypress.env("SKIP_BEFORE_HOOK") === undefined) {
    before(
      /**
       * @param {Mocha.Done} done
       */
      (done) => {
        process.nextTick(() => {
          throw new Error("before Error #1");
        });
        if (Cypress.env("MULTIPLE_HOOK_ERRORS") !== undefined) {
          process.nextTick(() => {
            done(new Error("before Error #2"));
          });
        }
      }
    );
  }

  if (Cypress.env("SKIP_BEFORE_EACH_HOOK") === undefined) {
    beforeEach(
      /**
       * @param {Mocha.Done} done
       */
      (done) => {
        process.nextTick(() => {
          throw new Error("before Error #1");
        });
        if (Cypress.env("MULTIPLE_HOOK_ERRORS") !== undefined) {
          process.nextTick(() => {
            done(new Error("before Error #2"));
          });
        }
      }
    );
  }

  // The before[Each] hook failure gets attached to this test.
  it("should fail due to hook", () => {
    if (Cypress.env("HOOK_AND_TEST_ERRORS") !== undefined) {
      throw new Error("test error");
    }
  });

  // This test should never run when a before()/beforeEach()/afterEach() hook fails.
  it("should be skipped", () => undefined);

  if (Cypress.env("SKIP_AFTER_EACH_HOOK") === undefined) {
    afterEach(
      /**
       * @param {Mocha.Done} done
       */
      (done) => {
        process.nextTick(() => {
          throw new Error("after Error #1");
        });
        if (Cypress.env("MULTIPLE_HOOK_ERRORS") !== undefined) {
          process.nextTick(() => {
            done(new Error("after Error #2"));
          });
        }
      }
    );
  }

  if (Cypress.env("SKIP_AFTER_HOOK") === undefined) {
    after(
      /**
       * @param {Mocha.Done} done
       */
      (done) => {
        process.nextTick(() => {
          throw new Error("after Error #1");
        });
        if (Cypress.env("MULTIPLE_HOOK_ERRORS") !== undefined) {
          process.nextTick(() => {
            done(new Error("after Error #2"));
          });
        }
      }
    );
  }
});
