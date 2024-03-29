// Copyright (c) 2023-2024 Developer Innovations, LLC

/**
 * Workaround for https://github.com/cypress-io/cypress/issues/27804.
 *
 * @param {Cypress.PluginEvents} on
 * @returns void
 */
export const fixHeadlessChrome = (on) => {
  on(
    "before:browser:launch",
    /**
     * @param {Cypress.Browser} browser,
     * @param {Cypress.BrowserLaunchOptions} launchOptions
     * @returns {void | Cypress.BrowserLaunchOptions}
     */
    (browser, launchOptions) => {
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
