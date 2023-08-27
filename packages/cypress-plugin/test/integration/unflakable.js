// Copyright (c) 2023 Developer Innovations, LLC

module.exports = {
  __unstableIsFailureTestIndependent: [
    // Cypress sometimes hangs waiting for Chrome tabs to close. See:
    // https://github.com/cypress-io/cypress/issues/27360
    // https://github.com/cypress-io/cypress/blob/fe54cf504aefcfa6b621a90baa57e345cfa09548/packages/server/lib/modes/run.ts#L676-L680
    // NB: This requires DEBUG="cypress:server:run" (at a minimum).
    /attempting to close the browser tab(?:(?!resetting server state).)*$/s,
    /Still waiting to connect to Edge, retrying in 1 second.*(?:Error: Test timed out after|All promises were rejected)/s,
    /There was an error reconnecting to the Chrome DevTools protocol\. Please restart the browser\./,
  ],
};
