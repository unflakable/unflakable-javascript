// Copyright (c) 2023-2024 Developer Innovations, LLC

const { openDevToolsOnLaunch } = require("config-js/devtools");
const webpackConfig = require("config-js/webpack");
const { registerTasks } = require("config-js/tasks");
const { registerSimpleGitMock } = require("unflakable-test-common/dist/git");
const {
  registerCosmiconfigMock,
} = require("unflakable-test-common/dist/config");
const { fixHeadlessChrome } = require("config-js/headless");

module.exports = {
  /**
   * @type {Cypress.ConfigOptions}
   */
  default: {
    component: {
      /**
       * @param {Cypress.PluginEvents} on
       * @param {Cypress.PluginConfigOptions} _config
       * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
       */
      setupNodeEvents(on, _config) {
        fixHeadlessChrome(on);
        registerCosmiconfigMock();
        registerSimpleGitMock();
        registerTasks(on);
      },
      devServer: {
        bundler: "webpack",
        framework: "react",
        webpackConfig,
      },
      supportFile: "cypress/support-js/component.js",
    },
    e2e: {
      /**
       * @param {Cypress.PluginEvents} on
       * @param {Cypress.PluginConfigOptions} _config
       * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
       */
      setupNodeEvents(on, _config) {
        fixHeadlessChrome(on);
        registerCosmiconfigMock();
        registerSimpleGitMock();
        registerTasks(on);
        openDevToolsOnLaunch(on);
      },
      supportFile: "cypress/support-js/e2e.js",
    },
    video: false,
  },
};
