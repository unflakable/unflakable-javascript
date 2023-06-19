// Copyright (c) 2023 Developer Innovations, LLC

// Webpack non-deterministically reports a TypeScript error here when run through Cypress. It seems
// to happen when `cypress-support-file` includes
// vendors-node_modules_cypress_react18_dist_cypress-react_esm-bundler_js.js instead of
// vendors-node_modules_cypress_react18_dist_cypress-react_cjs_js.js (printed when
// `stats: detailed` is set in the Webpack config). It's unclear if this is a caching issue or
// potentially caused by @unflakable/cypress-plugin being a CommonJS package (since Cypress assumes
// the project is based where the config file is). The non-determinism makes it hard to diagnose,
// but the tests seem to run despite the error.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      consoleLog(msg: string): Chainable;
    }
  }
}

Cypress.Commands.add("consoleLog", (msg: string) => cy.task("log", msg));
