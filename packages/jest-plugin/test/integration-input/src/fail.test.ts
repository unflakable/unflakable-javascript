// Copyright (c) 2022-2023 Developer Innovations, LLC

describe("describe block", () => {
  (process.env.SKIP_FAILURES !== undefined ? it.skip : it)(
    // Include some regex-significant characters to ensure that the retry regexes are escaped
    // properly.
    "should ([escape regex]?.*$ fail",
    () => {
      process.stderr.write("fail stderr\n");
      process.stdout.write("fail stdout\n");
      if (process.env.TEST_SNAPSHOTS !== undefined) {
        expect({ foo: true }).toMatchInlineSnapshot(`
          Object {
            "foo": false,
          }
        `);
      } else {
        throw new Error("test failed\nnew line");
      }
    }
  );
});
