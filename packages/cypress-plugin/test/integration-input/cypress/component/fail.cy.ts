// Copyright (c) 2023-2024 Developer Innovations, LLC

const testFn = Cypress.env("SKIP_FAILURES") !== undefined ? it.skip : it;

describe("describe block", () => {
  testFn("should fail", () => {
    throw new Error();
  });

  describe("inner block", () => {
    testFn("should showDiff", () => {
      expect("foobar").to.equal("foo");
    });
  });

  // Tests can fail with multiple exceptions, and we should print those as the Mocha spec reporter
  // does: https://github.com/mochajs/mocha/pull/4033.
  testFn("should fail with multiple exceptions", (done: Mocha.Done) => {
    process.nextTick(() => {
      throw new Error("first");
    });
    process.nextTick(() => {
      done(new Error("second"));
    });
  });
});
