// Copyright (c) 2023-2024 Developer Innovations, LLC

const { registerSimpleGitMock } = require("unflakable-test-common/dist/git");
const {
  registerCosmiconfigMock,
} = require("unflakable-test-common/dist/config");

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
        const { fixHeadlessChrome } = await import("./config-js/headless.js");

        fixHeadlessChrome(on);
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
        const { fixHeadlessChrome } = await import("./config-js/headless.js");

        fixHeadlessChrome(on);
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
