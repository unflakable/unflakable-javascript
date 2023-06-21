// Copyright (c) 2023 Developer Innovations, LLC

const {
  registerSimpleGitMock,
} = require("cypress-integration-common/dist/git");
const {
  registerCosmiconfigMock,
} = require("cypress-integration-common/dist/config");

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
      async setupNodeEvents(on, _config) {
        registerCosmiconfigMock();
        registerSimpleGitMock();

        const { registerTasks } = await import("./config-js/tasks.js");
        registerTasks(on);
      },
      devServer: {
        bundler: "webpack",
        framework: "react",
        webpackConfig: async () =>
          (await import("./config-js/webpack.js")).default,
      },
      supportFile: "cypress/support-js/component.cjs",
    },
    e2e: {
      /**
       * @param {Cypress.PluginEvents} on
       * @param {Cypress.PluginConfigOptions} _config
       * @returns {Promise<Cypress.PluginConfigOptions | void> | Cypress.PluginConfigOptions | void}
       */
      async setupNodeEvents(on, _config) {
        registerCosmiconfigMock();
        registerSimpleGitMock();

        const { registerTasks } = await import("./config-js/tasks.js");
        registerTasks(on);

        // Importing an ESM module from CJS requires dynamic import().

        const { openDevToolsOnLaunch } = await import(
          "./config-js/devtools.js"
        );

        openDevToolsOnLaunch(on);
      },
      supportFile: "cypress/support-js/e2e.cjs",
    },
    video: false,
  },
};
