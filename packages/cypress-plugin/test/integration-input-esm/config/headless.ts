// Copyright (c) 2023-2024 Developer Innovations, LLC

// Workaround for https://github.com/cypress-io/cypress/issues/27804.
export const fixHeadlessChrome = (on: Cypress.PluginEvents): void => {
  on(
    "before:browser:launch",
    (
      browser: Cypress.Browser,
      launchOptions: Cypress.BrowserLaunchOptions
    ): void | Cypress.BrowserLaunchOptions => {
      if (
        browser.family === "chromium" &&
        browser.name !== "electron" &&
        browser.isHeadless
      ) {
        launchOptions.args = launchOptions.args.map((arg) =>
          arg === "--headless" ? "--headless=new" : arg
        );
      }

      return launchOptions;
    }
  );
};
