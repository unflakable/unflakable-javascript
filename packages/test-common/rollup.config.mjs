// Copyright (c) 2023 Developer Innovations, LLC

import path from "path";
import pluginCommonJs from "@rollup/plugin-commonjs";
import pluginNodeResolve from "@rollup/plugin-node-resolve";
import pluginTypescript from "@rollup/plugin-typescript";
import pluginDts from "rollup-plugin-dts";

// We emit a CommonJS bundle so that both CommonJS and ESM targets can use this package. The package
// depends on plugins-common, which is ESM, so we have to use Rollup and can't rely solely on tsc.
// Otherwise, the transitive dependency remains ESM, which fails at runtime during require().

/**
 * @type {import("rollup").IsExternal}
 */
const isExternal = (id) =>
  !id.startsWith(".") &&
  !path.isAbsolute(id) &&
  !id.startsWith("src/") &&
  !["@unflakable/plugins-common"].includes(id);

/**
 * @type {import("rollup").NormalizedInputOptions[]}
 */
export default [
  {
    input: [
      "src/config.ts",
      "src/git.ts",
      "src/mock-backend.ts",
      "src/mock-cosmiconfig.ts",
      "src/mock-git.ts",
      "src/spawn.ts",
    ],
    output: {
      dir: "dist",
      format: "cjs",
      // Jest 28+ provides a .default export, while Jest < 28 directly exports the expect() function
      // as its top-level module.exports value. Using "compat" here lets us
      // `import { default as expect } from "expect"` with both versions.
      interop: (id) => (id === "expect" ? "compat" : "default"),
    },
    external: isExternal,
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
  },
  // Rollup types so that UnflakableConfig from @unflakable/plugins-common is bundled. Otherwise,
  // the integration-input* packages would need to depend on @unflakable/plugins-common, which we
  // don't want since we need to test that @unflakable/cypress-plugin bundles everything it needs
  // to.
  {
    input: "dist/config.d.ts",
    output: {
      file: "dist/config.d.ts",
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
