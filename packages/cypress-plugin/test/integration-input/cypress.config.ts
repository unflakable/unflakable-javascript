// Copyright (c) 2023 Developer Innovations, LLC

import { registerSimpleGitMock } from "cypress-integration-common/dist/git";
import { registerCosmiconfigMock } from "cypress-integration-common/dist/config";
import { defineConfig } from "cypress";
// This intentionally uses the CommonJS relative import syntax that doesn't start with `./` in
// order to test that our inclusion of the user config file resolves relative path imports (via
// Cypress's use of tsconfig-paths) correctly.
// eslint-disable-next-line import/no-unresolved
import { openDevToolsOnLaunch } from "config/devtools";
// eslint-disable-next-line import/no-unresolved
import webpackConfig from "config/webpack";
// eslint-disable-next-line import/no-unresolved
import { registerTasks } from "config/tasks";

export default defineConfig({
  component: {
    setupNodeEvents(on: Cypress.PluginEvents, _config) {
      registerCosmiconfigMock();
      registerSimpleGitMock();
      registerTasks(on);
      openDevToolsOnLaunch(on);
    },
    devServer: {
      bundler: "webpack",
      framework: "react",
      webpackConfig,
    },
    // supportFile: false,
  },
  e2e: {
    setupNodeEvents(
      on: Cypress.PluginEvents,
      _config
    ):
      | Promise<Cypress.PluginConfigOptions | void>
      | Cypress.PluginConfigOptions
      | void {
      registerCosmiconfigMock();
      registerSimpleGitMock();
      registerTasks(on);
      openDevToolsOnLaunch(on);
    },
    // retries: 2,
    // supportFile: false,
  },
  video: false,
});
