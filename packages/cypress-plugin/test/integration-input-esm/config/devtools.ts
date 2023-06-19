// Copyright (c) 2023 Developer Innovations, LLC

export const openDevToolsOnLaunch = (on: Cypress.PluginEvents): void => {
  // Open DevTools automatically. Only works for headed modes (i.e., not in screenshots or
  // recordings).
  on(
    "before:browser:launch",
    (
      browser: Cypress.Browser,
      launchOptions: Cypress.BrowserLaunchOptions
    ): void | Cypress.BrowserLaunchOptions => {
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
