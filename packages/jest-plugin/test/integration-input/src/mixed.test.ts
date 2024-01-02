// Copyright (c) 2022-2024 Developer Innovations, LLC

// This test contains both a failed test and a quarantined one, which the reporter should treat as
// a failed test file. However, the quarantined test should still be reported as having been
// quarantined.

describe("mixed", () => {
  (process.env.SKIP_QUARANTINED !== undefined ? it.skip : it)(
    "mixed: should be quarantined",
    () => {
      if (process.env.TEST_SNAPSHOTS !== undefined) {
        // NB: If we include a description here, Jest treats the snapshot as obsolete if the test
        // is skipped (and exits with a non-zero code) since it uses a string equality match
        // instead
        // of prefix check:
        // https://github.com/facebook/jest/blob/54eadb65a9f9ce789df6cf92df82cdbda68c0d4b/packages/jest-snapshot/src/State.ts#L99
        expect({ foo: false }).toMatchSnapshot();
      } else {
        // Have the snapshot pass here so that Jest doesn't treat it as obsolete.
        expect({ foo: true }).toMatchSnapshot();
        throw new Error("mixed quarantined test failed");
      }
    }
  );

  (process.env.SKIP_FAILURES !== undefined ? it.skip : it)(
    "mixed: should fail",
    () => {
      process.stderr.write("mixed fail stderr\n");
      process.stdout.write("mixed fail stdout\n");
      throw new Error("mixed test failed\nnew line");
    }
  );

  it("mixed: should pass", () => undefined);
});
