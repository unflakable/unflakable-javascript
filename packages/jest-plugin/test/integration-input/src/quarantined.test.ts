// Copyright (c) 2022-2024 Developer Innovations, LLC

describe("describe block", () => {
  (process.env.SKIP_QUARANTINED !== undefined ? it.skip : it)(
    "should be quarantined",
    () => {
      throw new Error("quarantined test failed");
    }
  );
});
