// Copyright (c) 2023-2024 Developer Innovations, LLC

import { defineConfig } from "cypress";
// Relative import paths require file extensions in ESM.
// See https://www.typescriptlang.org/docs/handbook/esm-node.html.
import * as devtools from "./config/devtools.js";
import { registerTasks } from "./config/tasks.js";
import webpackConfig from "./config/webpack.js";
import { registerSimpleGitMock } from "unflakable-test-common/dist/git.js";
import { registerCosmiconfigMock } from "unflakable-test-common/dist/config.js";
import { fixHeadlessChrome } from "./config/headless.js";

export default defineConfig({
  component: {
    setupNodeEvents(on: Cypress.PluginEvents, _config) {
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
    // supportFile: false,
  },
  e2e: {
    setupNodeEvents(
      on: Cypress.PluginEvents,
      _config: Cypress.PluginConfigOptions
    ):
      | Promise<Cypress.PluginConfigOptions | void>
      | Cypress.PluginConfigOptions
      | void {
      fixHeadlessChrome(on);
      registerCosmiconfigMock();
      registerSimpleGitMock();
      registerTasks(on);
      devtools.openDevToolsOnLaunch(on);
    },
    // retries: 2,
    // supportFile: false,
  },
  video: false,
});
