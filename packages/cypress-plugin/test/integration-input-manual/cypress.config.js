// Copyright (c) 2023 Developer Innovations, LLC

const { openDevToolsOnLaunch } = require("./config/devtools");
const { registerTasks } = require("./config/tasks");
const webpackConfig = require("./config/webpack");
const { registerSimpleGitMock } = require("unflakable-test-common/dist/git");
const {
  registerCosmiconfigMock,
} = require("unflakable-test-common/dist/config");
const semverGte = require("semver/functions/gte");

const { registerUnflakable } = require("@unflakable/cypress-plugin");
const path = require("path");
const { fixHeadlessChrome } = require("./config/headless");
const cypressOnFix = require("cypress-on-fix");

module.exports = {
  /**
   * @type {Cypress.ConfigOptions}
   */
  component: {
    /**
     * @param {Cypress.PluginEvents} baseOn
     * @param {Cypress.PluginConfigOptions} config
     * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
     */
    setupNodeEvents(baseOn, config) {
      const on = cypressOnFix(baseOn);
      fixHeadlessChrome(on);
      registerCosmiconfigMock();
      registerSimpleGitMock();
      registerTasks(on);

      return registerUnflakable(on, config);
    },
    devServer: {
      bundler: "webpack",
      framework: "react",
      webpackConfig,
    },
    // supportFile: "cypress/support/component.js",
  },
  e2e: {
    /**
     * @param {Cypress.PluginEvents} baseOn
     * @param {Cypress.PluginConfigOptions} config
     * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
     */
    setupNodeEvents(baseOn, config) {
      const on = cypressOnFix(baseOn);
      fixHeadlessChrome(on);
      registerCosmiconfigMock();
      registerSimpleGitMock();
      registerTasks(on);
      openDevToolsOnLaunch(on);

      // Versions prior to 12.17.4 use Webpack 4, which doesn't support the package.json "exports"
      // field (see https://github.com/cypress-io/cypress/issues/23826). Webpack 5 both supports and
      // enforces this field, so we have to use a different require path to manually import the
      // skip-tests module.
      if (semverGte(config.version, "12.17.4")) {
        config.supportFile = path.resolve("./cypress/support/e2e-webpack5.js");
      }

      return registerUnflakable(on, config);
    },
    // supportFile: "cypress/support/e2e.js",
  },
  quiet: true,
  // Test what happens if they're already using cypress-multi-reporters.
  // NB: We set installConfig.hoistingLimits in package.json so that Cypress can find
  // cypress-multi-reporters in its expected location in node_modules.
  reporter: "cypress-multi-reporters",
  reporterOptions: {
    configFile: "cypress-multi-reporters.config.json",
  },
  video: false,
};
