// Copyright (c) 2023-2024 Developer Innovations, LLC

export const openDevToolsOnLaunch =
  /**
   *
   * @param {Cypress.PluginEvents} on
   * @returns void
   */
  (on) => {
    // Open DevTools automatically. Only works for headed modes (i.e., not in screenshots or
    // recordings).
    on(
      "before:browser:launch",
      /**
       * @param {Cypress.Browser} browser,
       * @param {Cypress.BrowserLaunchOptions} launchOptions
       * @returns {void | Cypress.BrowserLaunchOptions}
       */
      (browser, launchOptions) => {
        if (browser.family === "chromium" && browser.name !== "electron") {
          // auto open devtools
          launchOptions.args.push("--auto-open-devtools-for-tabs");
        }

        if (browser.family === "firefox") {
          // auto open devtools
          launchOptions.args.push("-devtools");
        }

        if (browser.name === "electron") {
          // auto open devtools
          launchOptions.preferences.devTools = true;
        }

        // whatever you return here becomes the launchOptions
        return launchOptions;
      }
    );
  };
