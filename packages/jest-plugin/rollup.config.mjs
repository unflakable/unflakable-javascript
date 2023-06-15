// Copyright (c) 2023 Developer Innovations, LLC

import pluginTypescript from "@rollup/plugin-typescript";
import pluginNodeResolve from "@rollup/plugin-node-resolve";
import pluginCommonJs from "@rollup/plugin-commonjs";
import pluginJson from "@rollup/plugin-json";

/**
 * @type {import("rollup").NormalizedInputOptions}
 */
export default {
  input: ["src/reporter.ts", "src/runner.ts"],
  output: {
    dir: "dist",
    format: "cjs",
    // Mimicks TypeScript `esModuleInterop` (see
    // https://rollupjs.org/configuration-options/#output-format).
    interop: "auto",
    sourcemap: true,
  },
  // Bundle the internal @unflakable/plugins-common package in dist/, but leave most other
  // imported packages as an external. Internal modules begin with `.` or `/`.
  external: (id) =>
    !id.startsWith(".") &&
    !id.startsWith("/") &&
    !id.startsWith("src/") &&
    !id.startsWith("@unflakable/plugins-common/") &&
    ![
      // Support older versions of Jest that don't support sub-path externals in package.json.
      "@unflakable/js-api/consts",
      "@unflakable/plugins-common",
    ].includes(id),
  // Unclear why this is necessary.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  plugins: [
    pluginCommonJs(),
    pluginJson(),
    pluginNodeResolve(),
    pluginTypescript(),
  ],
};
