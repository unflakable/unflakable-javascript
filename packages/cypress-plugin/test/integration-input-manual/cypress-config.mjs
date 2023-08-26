// Copyright (c) 2023 Developer Innovations, LLC

import devtools from "./config/devtools.js";
import tasks from "./config/tasks.js";
import webpackConfig from "./config/webpack.js";
import { registerSimpleGitMock } from "unflakable-test-common/dist/git.js";
import { registerCosmiconfigMock } from "unflakable-test-common/dist/config.js";
import { registerUnflakable } from "@unflakable/cypress-plugin";
import semverGte from "semver/functions/gte.js";
import path from "path";

/**
 * @type {Cypress.ConfigOptions}
 */
export default {
  component: {
    /**
     * @param {Cypress.PluginEvents} on
     * @param {Cypress.PluginConfigOptions} config
     * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
     */
    setupNodeEvents(on, config) {
      registerCosmiconfigMock();
      registerSimpleGitMock();
      tasks.registerTasks(on);

      return registerUnflakable(on, config);
    },
    devServer: {
      bundler: "webpack",
      framework: "react",
      webpackConfig,
    },
    // supportFile: "cypress/support-js/component.js",
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
      tasks.registerTasks(on);
      devtools.openDevToolsOnLaunch(on);

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
