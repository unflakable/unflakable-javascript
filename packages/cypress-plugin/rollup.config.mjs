// Copyright (c) 2023-2024 Developer Innovations, LLC

import pluginCommonJs from "@rollup/plugin-commonjs";
import pluginDts from "rollup-plugin-dts";
import pluginJson from "@rollup/plugin-json";
import pluginNodeResolve from "@rollup/plugin-node-resolve";
import pluginTypescript from "@rollup/plugin-typescript";
import path from "path";

/**
 * Bundle the internal @unflakable/plugins-common package, along with dependencies used by
 * vendored Cypress code that Cypress itself also bundles (i.e., doesn't list in its public
 * package.json as deps) in dist/, but leave most other imported packages as external. Internal
 * modules begin with `.` or `/`. We don't include `term-size` here because it depends on a
 * bundled vendor/ directory that rollup doesn't include.
 *
 * @type {import("rollup").IsExternal}
 */
const isExternal = (id) =>
  !id.startsWith(".") &&
  !path.isAbsolute(id) &&
  !id.startsWith(`src/`) &&
  !id.startsWith("@unflakable/plugins-common/") &&
  ![
    // Avoid having skip-tests depend on @unflakable/js-api, which could pull in Node dependencies
    // that Webpack v5 doesn't bundle by default. It's also unclear which versions of Webpack
    // support sub-path exports from package.json like this. To avoid requiring any changes to
    // the user's Webpack config, we try to make skip-tests self-contained and easy to import.
    "@unflakable/js-api/consts",
    "@unflakable/plugins-common",
    "widest-line",
  ].includes(id);

const plugins = [
  pluginCommonJs(),
  pluginJson(),
  pluginNodeResolve({ preferBuiltins: true }),
  pluginTypescript({ tsconfig: "src/tsconfig.json" }),
];

const treeshake = {
  // Assume internal modules do not have side effects when they're imported. This helps remove
  // unnecessary require()'s from the transpiled code.
  moduleSideEffects: (id, external) => external,
};

/**
 * @type {import("rollup").NormalizedInputOptions}
 */
export default [
  {
    // NB: We exclude src/config-wrapper.ts since that needs to be compiled as an ESM target in
    // order to be able to import user cypress.config.js files for projects that use ESM. The reason
    // is that Cypress loads our config file and expects the default export to be the config
    // object, which requires us to load the user config file when our script loads. Dynamic
    // import() of ESM (require() can't import ESM modules) is async, but CommonJS doesn't support
    // await at the top level of a file (ESM does). To summarize: (1) code that's imported by Cypress
    // (with the exception of the config file, due to (2)) should be CommonJS, while (2) code that
    // imports user code should be ESM so that it supports both CommonJS and ESM user code.
    input: [
      "src/config-wrapper-sync.ts",
      "src/index.ts",
      "src/main.ts",
      "src/reporter.ts",
      "src/skip-tests.ts",
    ],
    output: {
      format: "cjs",
      dir: "dist",
      /**
       * @param {import("rollup").PreRenderedChunk} chunk
       * @returns {string}
       */
      banner: (chunk) => (chunk.name === "main" ? "#!/usr/bin/env node" : ""),
    },
    external: isExternal,
    plugins,
    treeshake,
  },
  {
    input: "src/config-wrapper.ts",
    output: {
      chunkFileNames: "[name]-[hash].mjs",
      file: "dist/config-wrapper.mjs",
      format: "es",
    },
    external: isExternal,
    plugins,
    treeshake,
  },
  // Rollup types so that UnflakableConfig from @unflakable/plugins-common is bundled. This package
  // doesn't get published separately, so our public types shouldn't reference it.
  {
    input: [
      // NB: This should include every exported .d.ts from package.json.
      "dist/config-wrapper-sync.d.ts",
      "dist/config-wrapper.d.ts",
      "dist/index.d.ts",
      "dist/reporter.d.ts",
      "dist/skip-tests.d.ts",
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
