// Copyright (c) 2023-2024 Developer Innovations, LLC

import devtools from "./config-js/devtools.js";
import tasks from "./config-js/tasks.js";
import webpackConfig from "./config-js/webpack.js";
import { registerSimpleGitMock } from "unflakable-test-common/dist/git.js";
import { registerCosmiconfigMock } from "unflakable-test-common/dist/config.js";
import headless from "./config-js/headless.js";

/**
 * @type {Cypress.ConfigOptions}
 */
export default {
  component: {
    /**
     * @param {Cypress.PluginEvents} on
     * @param {Cypress.PluginConfigOptions} _config
     * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
     */
    setupNodeEvents(on, _config) {
      headless.fixHeadlessChrome(on);
      registerCosmiconfigMock();
      registerSimpleGitMock();
      tasks.registerTasks(on);
    },
    devServer: {
      bundler: "webpack",
      framework: "react",
      webpackConfig,
    },
    supportFile: "cypress/support-js/component.mjs",
  },
  e2e: {
    /**
     * @param {Cypress.PluginEvents} on
     * @param {Cypress.PluginConfigOptions} _config
     * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
     */
    setupNodeEvents(on, _config) {
      headless.fixHeadlessChrome(on);
      registerCosmiconfigMock();
      registerSimpleGitMock();
      tasks.registerTasks(on);
      devtools.openDevToolsOnLaunch(on);
    },
    supportFile: "cypress/support-js/e2e.mjs",
  },
  video: false,
};
