// Copyright (c) 2023 Developer Innovations, LLC

export const registerTasks = (on: Cypress.PluginEvents): void => {
  // Used for both testing that the support file gets loaded and testing that the project's
  // setupNodeEvents() function gets called.
  on("task", {
    log: (s) => {
      console.log(s);
      return null;
    },
  });
};
