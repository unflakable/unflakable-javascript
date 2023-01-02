// Copyright (c) 2022-2023 Developer Innovations, LLC

it("should pass", () => {
  if (process.env.TEST_SNAPSHOTS !== undefined) {
    expect({ foo: true }).toMatchInlineSnapshot(`
      Object {
        "foo": true,
      }
    `);
  }
});
