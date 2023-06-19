// Copyright (c) 2023 Developer Innovations, LLC

it("stub should be pending");

it.skip("should be pending", () => undefined);

describe("suite name", () => {
  it.skip("suite test should be pending", () => undefined);

  it.skip("suite test should be quarantined and pending", () => undefined);
});
