// Copyright (c) 2023-2024 Developer Innovations, LLC

import { registerSimpleGitMock } from "unflakable-test-common/dist/git";
import { registerCosmiconfigMock } from "unflakable-test-common/dist/config";
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
// eslint-disable-next-line import/no-unresolved
import { fixHeadlessChrome } from "config/headless";
import cypressOnFix from "cypress-on-fix";

export default defineConfig({
  component: {
    setupNodeEvents(on: Cypress.PluginEvents, _config) {
      fixHeadlessChrome(on);
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
      baseOn: Cypress.PluginEvents,
      _config
    ):
      | Promise<Cypress.PluginConfigOptions | void>
      | Cypress.PluginConfigOptions
      | void {
      // Due to https://github.com/cypress-io/cypress/issues/22428, only the last event handler
      // registered for each event type will be called. This means we'll clobber any event handlers
      // the user registers. To avoid this, we use cypress-on-fix.
      // NB: Our plugin ordinarily does this for us, but we use this package to test what happens
      // when the plugin is disabled.
      const on = cypressOnFix(baseOn);

      fixHeadlessChrome(on);
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
