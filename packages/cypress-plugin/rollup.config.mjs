// Copyright (c) 2023 Developer Innovations, LLC

import pluginCommonJs from "@rollup/plugin-commonjs";
import pluginJson from "@rollup/plugin-json";
import pluginNodeResolve from "@rollup/plugin-node-resolve";
import pluginTypescript from "@rollup/plugin-typescript";

/**
 * @type {import("rollup").NormalizedInputOptions}
 */
export default {
  // NB: We exclude src/config-wrapper.ts since that needs to be compiled as an ESM target in
  // order to be able to import user cypress.config.js files for projects that use ESM. The reason
  // is that Cypress loads our config file and expects the default export to be the config
  // object, which requires us to load the user config file when our script loads. Dynamic
  // import() of ESM (require() can't import ESM modules) is async, but CommonJS doesn't support
  // await at the top level of a file (ESM does). To summarize: (1) code that's imported by Cypress
  // (with the exception of the config file, due to (2)) should be CommonJS, while (2) code that
  // imports user code should be ESM so that it supports both CommonJS and ESM user code.
  input: [
    "src/index.ts",
    "src/main.ts",
    "src/reporter.ts",
    "src/skip-tests.ts",
  ],
  output: {
    format: "cjs",
    /**
     * @param {import("rollup").PreRenderedChunk} chunk
     * @returns {string}
     */
    banner: (chunk) => (chunk.name === "main" ? "#!/usr/bin/env node" : ""),
  },
  // Bundle the internal @unflakable/plugins-common package, along with dependencies used by
  // vendored Cypress code that Cypress itself also bundles (i.e., doesn't list in its public
  // package.json as deps) in dist/, but leave most other imported packages as an external. Internal
  // modules begin with `.` or `/`. We don't include `term-size` here because it depends on a
  // bundled vendor/ directory that rollup doesn't include.
  external: (id) =>
    !id.startsWith(".") &&
    !id.startsWith("/") &&
    !id.startsWith("src/") &&
    !id.startsWith("@unflakable/plugins-common/") &&
    ![
      // Avoid having skip-tests depend on @unflakable/js-api, which could pull in Node dependencies
      // that Webpack v5 doesn't bundle by default. It's also unclear which versions of Webpack
      // support sub-path exports from package.json like this. To avoid requiring any changes to
      // the user's Webpack config, we try to make skip-tests self-contained and easy to import.
      "@unflakable/js-api/consts",
      "@unflakable/plugins-common",
      "widest-line",
    ].includes(id),
  plugins: [
    pluginCommonJs(),
    pluginJson(),
    pluginNodeResolve({ preferBuiltins: true }),
    pluginTypescript({ tsconfig: "src/tsconfig.json" }),
  ],
  treeshake: {
    // Assume internal modules do not have side effects when they're imported. This helps remove
    // unnecessary require()'s from the transpiled code.
    moduleSideEffects: (id, external) => external,
  },
};
