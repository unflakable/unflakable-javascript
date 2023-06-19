// Copyright (c) 2023 Developer Innovations, LLC

import pluginCommonJs from "@rollup/plugin-commonjs";
import pluginNodeResolve from "@rollup/plugin-node-resolve";
import pluginTypescript from "@rollup/plugin-typescript";

// We emit a CommonJS bundle so that both CommonJS and ESM targets can use this package. The package
// depends on plugins-common, which is ESM, so we have to use Rollup and can't rely solely on tsc.
// Otherwise, the transitive dependency remains ESM, which fails at runtime during require().

/**
 * @type {import("rollup").NormalizedInputOptions}
 */
export default {
  input: ["src/config.ts", "src/git.ts", "src/mock-cosmiconfig.ts"],
  output: {
    dir: "dist",
    format: "cjs",
  },
  external: (id) =>
    !id.startsWith(".") &&
    !id.startsWith("/") &&
    !id.startsWith("src/") &&
    !["@unflakable/plugins-common"].includes(id),
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  plugins: [
    pluginCommonJs(),
    pluginNodeResolve({ preferBuiltins: true }),
    pluginTypescript({ tsconfig: "src/tsconfig.json" }),
  ],
  treeshake: {
    // Assume internal modules do not have side effects when they're imported. This helps remove
    // unnecessary require()'s from the transpiled code.
    moduleSideEffects: (id, external) => external,
  },
};
