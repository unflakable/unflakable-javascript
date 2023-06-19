// Copyright (c) 2023 Developer Innovations, LLC

// This file runs inside the browser as part of the test code. It gets loaded by a Cypress support
// file injected by the plugin when quarantine mode is set to `skip_tests`.

// In order to skip quarantined tests, we wrap Cypress's Mocha it()/specify() function to replace
// quarantined test functions with calls to this.skip(). Cypress only supports Mocha's `bdd` syntax
// (see https://docs.cypress.io/guides/references/bundled-libraries), so there's no need to wrap
// other Mocha test functions such as test(). The approach we follow here is adapted from how
// Cypress wraps Mocha functions:
// https://github.com/cypress-io/cypress/blob/660ff675782dba8725e16620ca35fc38e004c23f/packages/driver/src/cypress/mocha.ts#L58-L122

// We also wrap context()/describe() so keep track of the hierarchical title path for each test,
// which is required for determining whether a test is quarantined.

// registerMochaInstrumentation() gets called by a Cypress support file that the plugin generates
// on the fly when quarantineMode is set to skip_tests.

import type { TestSuiteManifest } from "@unflakable/js-api";
// Avoid depending on Node.JS deps.
import { isTestQuarantined } from "@unflakable/plugins-common/quarantine";
import type { UnflakableConfig } from "@unflakable/plugins-common";
import path from "path-browserify";
import _debug from "debug";
import {
  CYPRESS_ENV_VAR_CONFIG,
  CYPRESS_ENV_VAR_MANIFEST,
  CYPRESS_ENV_VAR_REPO_ROOT,
} from "./cypress-env-vars";

const debug = _debug("unflakable:skip-tests");

const baseContext: Mocha.SuiteFunction = context;
const baseDescribe: Mocha.SuiteFunction = describe;
const baseIt: Mocha.TestFunction = it;
const baseSpecify: Mocha.TestFunction = specify;

type SuiteFunctionWithCypressConfigOverrides = (
  title: string,
  config: Cypress.SuiteConfigOverrides | undefined,
  fn: ((this: Mocha.Suite) => void) | undefined
) => Mocha.Suite;

type TestFunctionWithCypressConfigOverrides = (
  title: string,
  config: Cypress.TestConfigOverrides | undefined,
  fn: Mocha.Func | undefined
) => Mocha.Test;

// Adapted from what @cypress/grep does to get the complete test title:
// https://github.com/cypress-io/cypress/blob/7a18b79efae64dc1fc32fb5aaa89969e83971c6f/npm/grep/src/support.js#L142-L187
const suiteStack = [] as string[];
const instrumentDescribeFn = (fnName: "context" | "describe"): void => {
  const baseFn = fnName === "context" ? baseContext : baseDescribe;
  const instrumentedFnImpl = (subFn?: "only"): Mocha.ExclusiveSuiteFunction => {
    const base = (
      subFn === "only" ? baseFn.only : baseFn
    ) as SuiteFunctionWithCypressConfigOverrides;

    return ((...args: unknown[]): Mocha.Suite => {
      if (typeof args[0] !== "string") {
        // See:
        // https://github.com/mochajs/mocha/blob/81cfa9072b79fee57ba8fe1b9ddf8d774aa41f2e/lib/suite.js#L49-L57
        throw new Error(
          `Suite argument "title" must be a string. Received type "${typeof args[0]}"`
        );
      }

      suiteStack.push(args[0]);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const result = base(...args);
      suiteStack.pop();
      return result;
    }) as Mocha.ExclusiveSuiteFunction;
  };

  const instrumentedFn = instrumentedFnImpl() as Mocha.SuiteFunction;
  instrumentedFn.only = instrumentedFnImpl("only");
  instrumentedFn.skip = baseFn.skip;

  if (fnName === "context") {
    context = instrumentedFn;
  } else if (fnName === "describe") {
    describe = instrumentedFn;
  } else {
    throw new Error(
      `Unexpected fnName \`${
        fnName as string
      }\` should be \`context\` or \`describe\``
    );
  }
};

// Cypress overrides both it() and specify(), so we do likewise. See:
// https://github.com/cypress-io/cypress/blob/660ff675782dba8725e16620ca35fc38e004c23f/packages/driver/src/cypress/mocha.ts#L142-L143
const instrumentTestFn = (
  fnName: "it" | "specify",
  repoRoot: string,
  manifest: TestSuiteManifest | null
): void => {
  const baseFn = fnName === "it" ? baseIt : baseSpecify;
  const instrumentedFnImpl = (subFn?: "only"): Mocha.ExclusiveTestFunction => {
    const base = (
      subFn === "only" ? baseFn.only : baseFn
    ) as TestFunctionWithCypressConfigOverrides;

    const testInner = (
      title: string,
      config: Cypress.TestConfigOverrides | undefined,
      fn: Mocha.Func | undefined
    ): Mocha.Test => {
      const testFilename = path.relative(repoRoot, Cypress.spec.absolute);
      const titlePath = [...suiteStack, title];
      const isQuarantined =
        manifest !== null &&
        isTestQuarantined(manifest, testFilename, titlePath);

      debug(
        `Test is ${isQuarantined ? "" : "NOT "}quarantined: ${JSON.stringify(
          titlePath
        )} in file ${testFilename}`
      );

      if (isQuarantined) {
        // For some reason, calling baseFn.skip() causes infinite recursion in the Cypress runner.
        // Instead, we call Context.skip() in the test function, which has the added benefit of
        // working with it.only() calls without potentially causing it() tests to run as a result of
        // skipping the it.only() call.
        return (baseFn as TestFunctionWithCypressConfigOverrides)(
          title,
          config,
          function (): never {
            this.skip();
          }
        );
      } else {
        return base(title, config, fn);
      }
    };

    // This wraps the Cypress version of it(), which may be the 3-argument version that includes
    // Cypress.TestConfigOverrides as the second argument.
    return ((...args: unknown[]): Mocha.Test => {
      // In theory, Mocha supports calling it() without a test title (i.e., (fn: Func) => Test),
      // but in Cypress this always throws an exception, so we impose the same requirement for our
      // instrumented version (which requires a title for checking whether a test is quarantined).
      if (typeof args[0] !== "string") {
        // See:
        // https://github.com/mochajs/mocha/blob/52b9a5fb97bc3a6581dc6538aa0092276e71ea41/lib/test.js#L21-L27
        throw new Error(
          `Test argument "title" should be a string. Received type "${typeof args[0]}"`
        );
      } else if (typeof args[1] === "function") {
        // (title: string, fn?: Func): Test
        return testInner(args[0], {}, args[1] as Mocha.Func);
      } else {
        // (title: string, config: Cypress.TestConfigOverrides, fn?: Func): Test
        return testInner(
          args[0],
          args[1] as Cypress.TestConfigOverrides | undefined,
          args[2] as Mocha.Func | undefined
        );
      }
    }) as Mocha.ExclusiveTestFunction;
  };

  // @types/mocha defines a retries() method on TestFunction, but it seems like that's supposed to
  // be a method on Test, and Cypress doesn't do anything involving TestFunction.retries().
  const instrumentedFn = instrumentedFnImpl() as Mocha.TestFunction;
  instrumentedFn.only = instrumentedFnImpl("only");
  instrumentedFn.skip = baseFn.skip;

  if (fnName === "it") {
    it = instrumentedFn;
  } else if (fnName === "specify") {
    specify = instrumentedFn;
  } else {
    throw new Error(
      `Unexpected fnName \`${
        fnName as string
      }\` should be \`it\` or \`specify\``
    );
  }
};

export const registerMochaInstrumentation = (): void => {
  debug("Called registerMochaInstrumentation()");

  const manifestJson = Cypress.env(CYPRESS_ENV_VAR_MANIFEST) as
    | string
    | undefined;
  if (manifestJson === undefined) {
    throw new Error(
      `${CYPRESS_ENV_VAR_MANIFEST} environment variable is not set -- did you call registerUnflakable()?`
    );
  }
  const manifest = JSON.parse(manifestJson) as TestSuiteManifest | null;

  const configJson = Cypress.env(CYPRESS_ENV_VAR_CONFIG) as string | undefined;
  if (configJson === undefined) {
    throw new Error(
      `${CYPRESS_ENV_VAR_CONFIG} environment variable is not set`
    );
  }
  const unflakableConfig = JSON.parse(configJson) as UnflakableConfig;

  const repoRoot = Cypress.env(CYPRESS_ENV_VAR_REPO_ROOT) as string | undefined;
  if (repoRoot === undefined) {
    throw new Error(
      `${CYPRESS_ENV_VAR_REPO_ROOT} environment variable is not set`
    );
  }

  if (
    unflakableConfig.enabled &&
    unflakableConfig.quarantineMode === "skip_tests"
  ) {
    instrumentDescribeFn("context");
    instrumentDescribeFn("describe");
    instrumentTestFn("it", repoRoot, manifest);
    instrumentTestFn("specify", repoRoot, manifest);
  }
};
