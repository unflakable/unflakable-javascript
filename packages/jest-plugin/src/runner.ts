// Copyright (c) 2022-2023 Developer Innovations, LLC

import * as path from "path";
import type {
  AssertionResult,
  SerializableError,
  TestResult,
} from "@jest/test-result";
import { FAILED, groupBy, testKey, USER_AGENT } from "./utils";
import TestRunner, {
  OnTestFailure,
  OnTestStart,
  OnTestSuccess,
  Test,
  TestRunnerContext,
  TestRunnerOptions,
  TestWatcher,
} from "jest-runner";
import {
  TestSuiteManifest,
  getTestSuiteManifest,
  TEST_NAME_ENTRY_MAX_LENGTH,
} from "@unflakable/js-api";
import { UnflakableAssertionResult, UnflakableTestResult } from "./types";
import type { Config } from "@jest/types";
import chalk from "chalk";
import escapeStringRegexp from "escape-string-regexp";
import { debug as _debug } from "debug";
import deepEqual from "deep-equal";
import {
  loadConfigSync,
  QuarantineMode,
  UnflakableConfig,
} from "@unflakable/plugins-common";

const debug = _debug("unflakable:runner");

const printManifestError = (e: Error) => {
  process.stderr.write(
    chalk.stderr.red(
      `ERROR: Failed to get Unflakable manifest: ${e.toString()}\n`
    ) + chalk.stderr.yellow.bold("Test failures will NOT be quarantined.\n")
  );
};

type TestFailure = { test: Test; testResult: TestResult };

const wrapOnResult =
  ({
    attempt,
    cwd,
    manifest,
    onResult,
    quarantineMode,
    testFailures,
  }: {
    attempt: number;
    cwd: string;
    manifest: TestSuiteManifest | undefined;
    onResult: OnTestSuccess;
    quarantineMode: QuarantineMode;
    testFailures: TestFailure[];
  }) =>
  async (test: Test, testResult: TestResult): Promise<void> => {
    const testResults = testResult.testResults.map(
      (assertionResult: AssertionResult): UnflakableAssertionResult => {
        const testFilename = path.relative(cwd, test.path);
        if (assertionResult.status === FAILED) {
          if (manifest === undefined) {
            debug(
              "Not quarantining test failure due to failure to fetch manifest"
            );
          } else if (quarantineMode === "no_quarantine") {
            debug(
              "Not quarantining test failure because quarantineMode is set to `no_quarantine`"
            );
          } else if (
            manifest.quarantined_tests.some(
              (quarantinedTest) =>
                deepEqual(
                  quarantinedTest.name,
                  testKey({
                    ...assertionResult,
                    // See explanation below.
                    title: assertionResult.title.substring(
                      0,
                      TEST_NAME_ENTRY_MAX_LENGTH
                    ),
                  })
                ) && quarantinedTest.filename === testFilename
            )
          ) {
            debug(
              `Quarantining failed test ${JSON.stringify(
                testKey(assertionResult)
              )} from file ${testFilename}`
            );
            return {
              ...assertionResult,
              // Use a separate field instead of adding a new `status` to avoid confusing third-
              // party code that consumes the `Status` enum.
              _unflakableIsQuarantined: true,
            };
          }
        }
        return assertionResult;
      }
    );

    const numFailingTests = testResults.filter(
      (assertionResult) =>
        assertionResult.status === FAILED &&
        assertionResult._unflakableIsQuarantined !== true
    ).length;
    const numQuarantinedTests = testResults.filter(
      (assertionResult) => assertionResult._unflakableIsQuarantined === true
    ).length;
    const processedTestResult: UnflakableTestResult =
      attempt === 0
        ? {
            ...testResult,
            // NB: If this value is non-zero, the whole Jest run will terminate with a non-zero exit
            // code.
            numFailingTests,
            _unflakableAttempt: attempt,
            _unflakableNumQuarantinedTests: numQuarantinedTests,
            testResults,
          }
        : // Don't double-count retried tests or SummaryReporter will produce confusing results.
          {
            ...testResult,
            numFailingTests: 0,
            numPassingTests: 0,
            numPendingTests: 0,
            numTodoTests: 0,
            _unflakableAttempt: attempt,
            _unflakableNumQuarantinedTests: numQuarantinedTests,
            testResults,
          };

    if (numFailingTests > 0 || numQuarantinedTests > 0) {
      testFailures.push({ test, testResult });
    }

    await onResult(test, processedTestResult);
  };

class UnflakableRunner {
  private readonly context?: TestRunnerContext;
  private readonly cwd: string;
  private readonly globalConfig: Config.GlobalConfig;
  private readonly manifest: Promise<TestSuiteManifest | undefined>;
  private readonly unflakableConfig: UnflakableConfig;

  constructor(globalConfig: Config.GlobalConfig, context?: TestRunnerContext) {
    this.cwd = process.cwd();
    this.unflakableConfig = loadConfigSync(globalConfig.rootDir);

    const testSuiteId = this.unflakableConfig.enabled
      ? this.unflakableConfig.testSuiteId
      : "";

    if (
      this.unflakableConfig.enabled &&
      process.env.UNFLAKABLE_API_KEY !== undefined &&
      process.env.UNFLAKABLE_API_KEY !== ""
    ) {
      const apiKey = process.env.UNFLAKABLE_API_KEY;
      this.manifest = getTestSuiteManifest({
        testSuiteId,
        apiKey,
        baseUrl: this.unflakableConfig.apiBaseUrl,
        clientDescription: USER_AGENT,
      })
        .catch((e: Error) => {
          printManifestError(e);
          return undefined;
        })
        .then((manifest: TestSuiteManifest | undefined) => {
          debug("Unflakable manifest:", manifest);
          return manifest;
        });
    } else if (this.unflakableConfig.enabled) {
      throw new Error(
        "missing required environment variable `UNFLAKABLE_API_KEY`"
      );
    } else {
      debug("Not fetching manifest because plugin is disabled");
      this.manifest = Promise.resolve(undefined);
    }

    this.context = context;
    this.globalConfig = globalConfig;
  }

  async runTests(
    tests: Array<Test>,
    watcher: TestWatcher,
    onStart: OnTestStart,
    onResult: OnTestSuccess,
    onFailure: OnTestFailure,
    options: TestRunnerOptions
  ): Promise<void> {
    let testFailures = await this.runTestsImpl(
      tests,
      watcher,
      onStart,
      onResult,
      onFailure,
      options,
      this.cwd,
      this.globalConfig,
      this.context,
      this.unflakableConfig,
      await this.manifest,
      0 // attempt
    );

    if (!this.unflakableConfig.enabled || testFailures.length === 0) {
      return;
    }

    const attempts =
      this.unflakableConfig.failureRetries > 0
        ? this.unflakableConfig.failureRetries + 1
        : 1;
    // NB: jest-circus also supports failure retries, but it's configured via the `jest` object
    // in each test file's environment, not via the global config that we have control over.
    for (
      let attempt = 1;
      testFailures.length !== 0 && attempt < attempts;
      attempt++
    ) {
      process.stderr.write(
        chalk.stderr.yellow.bold(
          `Retrying ${testFailures.reduce(
            (count, { testResult }) => count + testResult.numFailingTests,
            0
          )} failed test(s) from ${testFailures.length} file(s) -- ${
            attempts - attempt - 1
          } ${attempts - attempt - 1 === 1 ? "retry" : "retries"} remaining\n`
        )
      );

      // Similar to how we skip quarantined tests when quarantineMode is "skip_tests", we need to
      // re-run each failed file separately so that we can pass a custom testNamePattern regex to
      // each. This ensures that we only rerun the failed tests in each file.
      testFailures = await testFailures.reduce(
        (promise, { test, testResult }) =>
          promise.then(async (newTestFailures) => {
            const failedTestPattern = testResult.testResults
              .filter(
                (assertionResult: UnflakableAssertionResult) =>
                  assertionResult.status === FAILED &&
                  assertionResult._unflakableIsQuarantined !== true
              )
              .map((failedTest) => {
                const testId = testKey(failedTest);
                return `(^${escapeStringRegexp(testId.join(" "))}$)`;
              })
              .join("|");
            const testNamePattern =
              this.globalConfig.testNamePattern !== undefined &&
              this.globalConfig.testNamePattern.length > 0
                ? `^(?=${failedTestPattern}).*${this.globalConfig.testNamePattern}`
                : failedTestPattern;
            debug(
              `Retrying failed test file ${test.path} with test name regex: \`${testNamePattern}\``
            );
            const filteredGlobalConfig = Object.freeze({
              ...this.globalConfig,
              testNamePattern,
            });
            return newTestFailures.concat(
              await this.runTestsImpl(
                [test],
                watcher,
                onStart,
                // We re-wrap it in the next iteration.
                onResult,
                onFailure,
                options,
                this.cwd,
                filteredGlobalConfig,
                this.context,
                this.unflakableConfig,
                await this.manifest,
                attempt
              )
            );
          }),
        Promise.resolve([] as TestFailure[])
      );
    }
  }

  private async runTestsImpl(
    tests: Test[],
    watcher: TestWatcher,
    onStart: OnTestStart,
    onResult: OnTestSuccess,
    onFailure: OnTestFailure,
    options: TestRunnerOptions,
    cwd: string,
    globalConfig: Config.GlobalConfig,
    context: TestRunnerContext | undefined,
    unflakableConfig: UnflakableConfig,
    manifest: TestSuiteManifest | undefined,
    attempt: number
  ): Promise<TestFailure[]> {
    const testFailures: TestFailure[] = [];

    const onResultImpl = this.unflakableConfig.enabled
      ? wrapOnResult({
          attempt,
          cwd,
          manifest,
          onResult,
          quarantineMode: unflakableConfig.quarantineMode,
          testFailures,
        })
      : onResult;

    const runTests = (
      globalConfig: Config.GlobalConfig,
      tests: Array<Test>,
      watcher: TestWatcher,
      options: TestRunnerOptions
    ): Promise<void> => {
      const testRunner = new TestRunner(globalConfig, context ?? {});

      // We have to give up on per-event type safety here to maintain compatibility with versions
      // prior to 26.2.0.
      type EventListener = (eventData: unknown) => void | Promise<void>;
      type EventSubscriber = (
        eventName: string,
        listener: EventListener
      ) => () => void;

      // The event emitter interface was introduced in Jest 26.2.0 (see
      // https://github.com/facebook/jest/pull/10227).
      if ((testRunner as unknown as { on?: unknown }).on !== undefined) {
        const eventEmittingTestRunner = testRunner as unknown as {
          on: EventSubscriber;
        };
        eventEmittingTestRunner.on("test-file-start", (([test]: [Test]) =>
          onStart(test)) as EventListener);
        eventEmittingTestRunner.on("test-file-success", (([test, result]: [
          Test,
          TestResult
        ]) => onResultImpl(test, result)) as EventListener);
        eventEmittingTestRunner.on("test-file-failure", (([test, error]: [
          Test,
          SerializableError
        ]) => onFailure(test, error)) as EventListener);

        return testRunner.runTests.length === 6
          ? // Jest prior to 28.0.0 expects the callback arguments (see
            // https://github.com/facebook/jest/pull/12641).
            (
              testRunner.runTests as unknown as (
                tests: Array<Test>,
                watcher: TestWatcher,
                onStart: OnTestStart | undefined,
                onResult: OnTestSuccess | undefined,
                onFailure: OnTestFailure | undefined,
                options: TestRunnerOptions
              ) => Promise<void>
            )(
              tests,
              // FIXME(FLAKE-136): make this interact with the watcher in a sensible way (or error
              // out explicitly).
              watcher,
              undefined,
              undefined,
              undefined,
              options
            )
          : // Jest >= 28.0.0 no longer expects the callback arguments.
            (
              testRunner.runTests as unknown as (
                tests: Array<Test>,
                watcher: TestWatcher,
                options: TestRunnerOptions
              ) => Promise<void>
            )(tests, watcher, options);
      } else {
        // Prior to Jest 26.2.0, use the legacy callback interface.
        return (
          testRunner.runTests as unknown as (
            tests: Array<Test>,
            watcher: TestWatcher,
            onStart: OnTestStart | undefined,
            onResult: OnTestSuccess | undefined,
            onFailure: OnTestFailure | undefined,
            options: TestRunnerOptions
          ) => Promise<void>
        )(
          tests,
          // FIXME(FLAKE-136): make this interact with the watcher in a sensible way (or error
          // out explicitly).
          watcher,
          onStart,
          // This gets called on unhandled exceptions, not on ordinary test failures. Don't
          // quarantine these.
          onResultImpl,
          onFailure,
          options
        );
      }
    };

    if (
      manifest !== undefined &&
      manifest.quarantined_tests.length > 0 &&
      unflakableConfig.quarantineMode === "skip_tests"
    ) {
      debug(
        `Skipping ${manifest.quarantined_tests.length} quarantined test(s)`
      );
      const quarantinedTestsByFile = groupBy(
        manifest.quarantined_tests,
        (testRef) => testRef.filename
      );

      // The test filter regex is part of the (frozen) GlobalConfig. Since we can't specify a
      // per-test-file regex, we instead invoke the runner once for each file that contains at least
      // one quarantined test. This effectively serializes the test file runs, which may add some
      // overhead vs. running them in parallel (if `options.serial` is false; see jest-runner).
      // However, we only do this for quarantined tests, of which there are hopefully not many.
      // Then, we run the remaining test files normally below.
      await tests
        .reduce((promise, test) => {
          const relPath = path.relative(cwd, test.path);
          const quarantinedTestsInFile = quarantinedTestsByFile[relPath];
          if (
            quarantinedTestsInFile !== undefined &&
            quarantinedTestsInFile.length > 0
          ) {
            // NB: There are three limitations to this regex:
            //  1) Jest's regex lookup is case-insensitive, so this will also skip any tests in the
            //     same file whose names differ only in capitalization (hopefully rare).
            //  2) Jest concatenates the describe() and it() block names together into a single
            //     space-delimited string ("test ID"). If multiple tests in a single file map
            //     case-insensitively to the same space-delimited string, we'll skip those as well.
            //  3) The backend limits test names to a max of 8 components, each with a max of 4096
            //     characters. The last component will be truncated to 4096 characters, meaning that
            //     the regex may match multiple tests if they have different suffixes.
            const skipPattern = quarantinedTestsInFile
              .map(
                (quarantinedTest) =>
                  `(${escapeStringRegexp(quarantinedTest.name.join(" "))}${
                    // If the last component is truncated due to excessive length, do a prefix match
                    // instead of an exact match. Otherwise, we won't quarantine these tests. The
                    // downside is that we'll quarantine all tests that share the same prefix.
                    quarantinedTest.name[quarantinedTest.name.length - 1]
                      .length < TEST_NAME_ENTRY_MAX_LENGTH
                      ? "$"
                      : ""
                  })`
              )
              .join("|");
            const testNamePattern =
              globalConfig.testNamePattern !== undefined &&
              globalConfig.testNamePattern.length > 0
                ? `^(?!${skipPattern}).*${globalConfig.testNamePattern}`
                : `^(?!${skipPattern}).*`;
            debug(
              `Testing file ${test.path} with test name regex: \`${testNamePattern}\``
            );
            const filteredGlobalConfig = Object.freeze({
              ...globalConfig,
              testNamePattern,
            });
            return promise.then(() =>
              runTests(filteredGlobalConfig, [test], watcher, options)
            );
          } else {
            return promise;
          }
        }, Promise.resolve())
        .then(() => {
          const normalTestFiles = tests.filter(
            (test) => !(path.relative(cwd, test.path) in quarantinedTestsByFile)
          );
          if (normalTestFiles.length > 0) {
            debug(
              `Testing ${normalTestFiles.length} remaining file(s) with no quarantined tests`
            );
            return runTests(globalConfig, normalTestFiles, watcher, options);
          } else {
            return Promise.resolve();
          }
        });
    } else {
      await runTests(globalConfig, tests, watcher, options);
    }
    return testFailures;
  }
}

export default UnflakableRunner;
