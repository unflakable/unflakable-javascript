// Copyright (c) 2023 Developer Innovations, LLC

const { openDevToolsOnLaunch } = require("./config/devtools");
const { registerTasks } = require("./config/tasks");
const webpackConfig = require("./config/webpack");
const { registerSimpleGitMock } = require("unflakable-test-common/dist/git");
const {
  registerCosmiconfigMock,
} = require("unflakable-test-common/dist/config");

const { registerUnflakable } = require("@unflakable/cypress-plugin");

module.exports = {
  /**
   * @type {Cypress.ConfigOptions}
   */
  component: {
    /**
     * @param {Cypress.PluginEvents} on
     * @param {Cypress.PluginConfigOptions} config
     * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
     */
    setupNodeEvents(on, config) {
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
     * @param {Cypress.PluginEvents} on
     * @param {Cypress.PluginConfigOptions} config
     * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
     */
    setupNodeEvents(on, config) {
      registerCosmiconfigMock();
      registerSimpleGitMock();
      registerTasks(on);
      openDevToolsOnLaunch(on);

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
