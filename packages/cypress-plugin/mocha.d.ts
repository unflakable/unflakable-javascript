// Copyright (c) 2023 Developer Innovations, LLC

type GlobalError = Error;

// NB: Cypress exports its own copy of @types/mocha, so we don't depend on that package directly.

declare namespace Mocha {
  // This type is inferred from Mocha.reporters.Base.list(), Mocha.reporters.Base.showDiff(), and
  // Mocha's EVENT_TEST_FAIL handler:
  // https://github.com/mochajs/mocha/blob/1412dc80d87d0479f7f1d60202da2b33c90eb939/lib/reporters/base.js#L235
  // https://github.com/mochajs/mocha/blob/1412dc80d87d0479f7f1d60202da2b33c90eb939/lib/reporters/base.js#L157C1-L164
  // https://github.com/mochajs/mocha/blob/1412dc80d87d0479f7f1d60202da2b33c90eb939/lib/reporters/base.js#L317-L329
  export type Error = GlobalError & {
    actual?: unknown;
    expected?: unknown;
    inspect?: () => string;
    multiple?: Mocha.Error[];
    showDiff?: boolean;
  };

  // Additional fields that Cypress adds to Mocha.Test.
  export type CypressTestProps = {
    id: string;
    order: number;
    wallClockStartedAt: string;
  };

  export type CypressTest = Test & CypressTestProps;

  // Since Mocha.Test objects need to be serialized before they can be sent from the Cypress driver
  // in the browser to the Node server, the event payload isn't an actual Mocha.Test instance.
  // For every event type except retries, Cypress merges the event payload back into the proper
  // Mocha.Test instance that already exists on the Node server side.
  // Mocha.Test properties that get sent from the browser driver to the Cypress Node server
  // are listed here:
  // https://github.com/cypress-io/cypress/blob/660ff675782dba8725e16620ca35fc38e004c23f/packages/driver/src/cypress/runner.ts#L27
  // Cypress merging of event payloads for different event types is implemented here:
  // https://github.com/cypress-io/cypress/blob/b0c0eaa508bb6dafdc1997bc00fb7ed6f5bcc160/packages/server/lib/reporter.js#L223-L238
  export type MochaEventTest = Pick<
    Test,
    | "title"
    | "err"
    | "state"
    | "pending"
    | "body"
    | "speed"
    | "type"
    | "duration"
  > &
    CypressTestProps & {
      currentRetry: number;
      retries: number;
    };

  namespace reporters {
    namespace Base {
      // Exported here:
      // https://github.com/mochajs/mocha/blob/9c10adab3340abd8baff147cb595256234d88de6/lib/mocha.js#L876
      let hideDiff: boolean | undefined;

      // This function is exported by Mocha but missing from Cypress's exported @types/mocha:
      // https://github.com/mochajs/mocha/blob/1412dc80d87d0479f7f1d60202da2b33c90eb939/lib/reporters/base.js#L157-L164
      function showDiff(err: unknown): err is Mocha.Error;
    }
  }
}
