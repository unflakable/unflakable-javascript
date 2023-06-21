// Copyright (c) 2023 Developer Innovations, LLC

import { openDevToolsOnLaunch } from "./config-js/devtools.js";
import { registerTasks } from "./config-js/tasks.js";
import webpackConfig from "./config-js/webpack.js";
import { registerSimpleGitMock } from "cypress-integration-common/dist/git.js";
import { registerCosmiconfigMock } from "cypress-integration-common/dist/config.js";

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
      registerCosmiconfigMock();
      registerSimpleGitMock();
      registerTasks(on);
      openDevToolsOnLaunch(on);
    },
    supportFile: "cypress/support-js/e2e.js",
  },
  video: false,
};
