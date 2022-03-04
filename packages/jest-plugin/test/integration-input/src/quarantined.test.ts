// Copyright (c) 2022 Developer Innovations, LLC

describe("describe block", () => {
  (process.env.SKIP_QUARANTINED !== undefined ? it.skip : it)(
    "should be quarantined",
    () => {
      throw new Error();
    }
  );
});
