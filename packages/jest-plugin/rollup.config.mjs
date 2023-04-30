// Copyright (c) 2023 Developer Innovations, LLC

import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";

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
  // Bundle the internal @unflakable\/plugins-common package in dist/, but leave every other
  // imported package as an external. Internal modules begin with `.` or `/`.
  external: /^(?![./]|@unflakable\/plugins-common)/,
  plugins: [nodeResolve(), typescript()],
};
