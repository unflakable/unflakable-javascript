// Copyright (c) 2022 Developer Innovations, LLC

import fs from "fs/promises";

(process.env.SKIP_FLAKE !== undefined ? it.skip.each : it.each)([1, 2])(
  `should be flaky %d${process.env.FLAKE_TEST_NAME_SUFFIX ?? ""}`,
  async (i) => {
    if (process.env.FLAKY_TEST_TEMP === undefined) {
      throw new Error("missing FLAKY_TEST_TEMP environment variable");
    }

    const tempFilePath = `${process.env.FLAKY_TEST_TEMP}${i}`;
    // We can't maintain in-memory state between test tries, so we write to a temp file to indicate
    // that it's not the first attempt.
    const exists = await fs
      .stat(tempFilePath)
      .then(() => true)
      .catch(() => false);
    await fs.writeFile(tempFilePath, "");

    if (process.env.TEST_SNAPSHOTS !== undefined) {
      expect({ exists }).toMatchInlineSnapshot(`
        Object {
          "exists": true,
        }
      `);
    } else if (!exists) {
      throw new Error("first try should fail");
    }
  }
);
