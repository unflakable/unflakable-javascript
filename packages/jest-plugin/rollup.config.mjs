// Copyright (c) 2023 Developer Innovations, LLC

import path from "path";
import pluginCommonJs from "@rollup/plugin-commonjs";
import pluginDts from "rollup-plugin-dts";
import pluginJson from "@rollup/plugin-json";
import pluginNodeResolve from "@rollup/plugin-node-resolve";
import pluginTypescript from "@rollup/plugin-typescript";

/**
 * Bundle the internal @unflakable/plugins-common package, but leave most other imported packages
 * as external. Internal modules begin with `.` or `/`.
 *
 * @type {import("rollup").IsExternal}
 */
const isExternal = (id) =>
  !id.startsWith(".") &&
  !path.isAbsolute(id) &&
  !id.startsWith("src/") &&
  !id.startsWith("@unflakable/plugins-common/") &&
  ![
    // Support older versions of Jest that don't support sub-path externals in package.json.
    "@unflakable/js-api/consts",
    "@unflakable/plugins-common",
  ].includes(id);

/**
 * @type {import("rollup").NormalizedInputOptions}
 */
export default [
  {
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
    external: isExternal,
    // Unclear why this is necessary.
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    plugins: [
      pluginCommonJs(),
      pluginJson(),
      pluginNodeResolve(),
      pluginTypescript(),
    ],
  },
  // Rollup types so that UnflakableConfig from @unflakable/plugins-common is bundled. This package
  // doesn't get published separately, so our public types shouldn't reference it.
  {
    input: [
      // NB: This should include every exported .d.ts from package.json.
      "dist/reporter.d.ts",
      "dist/runner.d.ts",
    ],
    output: {
      dir: ".",
      entryFileNames: "[name].d.ts",
      format: "cjs",
    },
    external: isExternal,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    plugins: [
      pluginNodeResolve({ preferBuiltins: true }),
      pluginDts({
        respectExternal: true,
      }),
    ],
  },
];
