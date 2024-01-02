// Copyright (c) 2022-2024 Developer Innovations, LLC

import fs from "fs/promises";

(process.env.SKIP_FLAKE !== undefined ? it.skip.each : it.each)([1, 2])(
  `should be flaky %d${process.env.FLAKE_TEST_NAME_SUFFIX ?? ""}`,
  async (i) => {
    if (process.env.FLAKY_TEST_TEMP === undefined) {
      throw new Error("missing FLAKY_TEST_TEMP environment variable");
    } else if (process.env.FLAKE_FAIL_COUNT === undefined) {
      throw new Error("missing FLAKE_FAIL_COUNT environment variable");
    }

    const tempFilePath = `${process.env.FLAKY_TEST_TEMP}${i}`;
    // We can't maintain in-memory state between test tries, so we write to a temp file.
    const attempt = await fs
      .readFile(tempFilePath, { encoding: "utf8" })
      .then(Number.parseInt)
      .catch(() => 0);
    await fs.writeFile(tempFilePath, (attempt + 1).toString());

    if (process.env.TEST_SNAPSHOTS !== undefined) {
      expect({ exists: attempt > 0 }).toMatchInlineSnapshot(`
        Object {
          "exists": true,
        }
      `);
    } else if (attempt < Number.parseInt(process.env.FLAKE_FAIL_COUNT)) {
      throw new Error(`first try should fail`);
    }
  }
);
