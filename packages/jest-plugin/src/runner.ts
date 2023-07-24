// Copyright (c) 2022-2023 Developer Innovations, LLC

import * as path from "path";
import type { SerializableError, TestResult } from "@jest/test-result";
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
  TEST_NAME_ENTRY_MAX_LENGTH,
  TestSuiteManifest,
} from "@unflakable/js-api";
import {
  UnflakableAssertionResult,
  UnflakableJestConfig,
  UnflakableTestResult,
} from "./types";
import type { Config } from "@jest/types";
import chalk from "chalk";
import escapeStringRegexp from "escape-string-regexp";
import { debug as _debug } from "debug";
import {
  getRepoRoot,
  getTestSuiteManifest,
  isTestQuarantined,
  loadApiKey,
  loadGitRepo,
  toPosix,
} from "@unflakable/plugins-common";
import { TestEvents, UnsubscribeFn } from "jest-circus/runner";
import { loadConfig } from "./config";
import util from "util";

const debug = _debug("unflakable:runner");

type TestFailure = { test: Test; testResult: UnflakableTestResult };

class UnflakableRunner {
  readonly supportsEventEmitters = true;

  private readonly context?: TestRunnerContext;
  private readonly globalConfig: Config.GlobalConfig;
  private readonly manifest: Promise<TestSuiteManifest | undefined>;
  private readonly unflakableConfig: UnflakableJestConfig;

  private readonly capturedOutput: {
    [key in string]: {
      stderr: string;
      stdout: string;
    };
  } = {};

  private testEventHandlers: {
    [key in keyof TestEvents]?: ((
      eventData: TestEvents[key]
    ) => void | Promise<void>)[];
  } = {};

  constructor(globalConfig: Config.GlobalConfig, context?: TestRunnerContext) {
    debug("constructor");
    this.unflakableConfig = loadConfig(globalConfig.rootDir);

    const testSuiteId = this.unflakableConfig.enabled
      ? this.unflakableConfig.testSuiteId
      : "";

    if (this.unflakableConfig.enabled) {
      const apiKey = loadApiKey();
      this.manifest = getTestSuiteManifest({
        testSuiteId,
        apiKey,
        baseUrl: this.unflakableConfig.apiBaseUrl,
        clientDescription: USER_AGENT,
        log: process.stderr.write.bind(process.stderr),
      });
    } else {
      debug("Not fetching manifest because plugin is disabled");
      this.manifest = Promise.resolve(undefined);
    }

    this.context = context;
    this.globalConfig = globalConfig;
  }

  // We expose an on() method that TestScheduler can call to register its event callbacks:
  // https://github.com/jestjs/jest/blob/7cf50065ace0f0fffeb695a7980e404a17d3b761/packages/jest-core/src/TestScheduler.ts#L264.
  // We also return an unsubscribe function from each call, although unsubscribing doesn't seem to
  // serve much of a purpose since the test runner goes out of scope immediately after Jest calls
  // the unsubscribe functions. We just do the same thing Jest does and unregister our own handlers
  // before the inner TestRunner goes out of scope, and then clear the TestScheduler's registered
  // callbacks from UnflakableTestRunner when TestScheduler calls its unsubscribe functions. This
  // may be needed to break circular references and ensure that everything gets GCed.
  on<Name extends keyof TestEvents>(
    eventName: Name,
    listener: (eventData: TestEvents[Name]) => void | Promise<void>
  ): UnsubscribeFn {
    debug(`subscribing to \`${eventName}\` listener`);
    if (this.testEventHandlers[eventName] === undefined) {
      this.testEventHandlers[eventName] = [];
    }

    type EventListener = (eventData: TestEvents[Name]) => void | Promise<void>;

    (this.testEventHandlers[eventName] as EventListener[]).push(listener);

    return () => {
      debug(`unsubscribing from \`${eventName}\` listener`);
      const idx = (
        this.testEventHandlers[eventName] as EventListener[]
      ).indexOf(listener);
      if (idx !== -1) {
        (this.testEventHandlers[eventName] as EventListener[]).splice(idx, 1);
      }
    };
  }

  private async isFailureTestIndependent(
    testFilePath: string,
    assertionResult: UnflakableAssertionResult
  ): Promise<boolean> {
    if (typeof this.unflakableConfig.isFailureTestIndependent === "function") {
      return this.unflakableConfig.isFailureTestIndependent({
        failure: assertionResult.failureMessages.join("\n"),
        stdout: assertionResult._unflakableCapturedStdout ?? "",
        stderr: assertionResult._unflakableCapturedStderr ?? "",
        testFilePath,
        testName: [...assertionResult.ancestorTitles, assertionResult.title],
      });
    } else if (Array.isArray(this.unflakableConfig.isFailureTestIndependent)) {
      return this.unflakableConfig.isFailureTestIndependent.some(
        (regex) =>
          regex.test(assertionResult.failureMessages.join("\n")) ||
          regex.test(assertionResult._unflakableCapturedStdout ?? "") ||
          regex.test(assertionResult._unflakableCapturedStderr ?? "")
      );
    }
    return false;
  }

  // Called after each test *file* runs successfully (which may include failed tests, but the test
  // file itself didn't throw any errors when it was loaded). This function modifies
  // `testResult.testResults` by adding our own fields, and returns an updated
  // `UnflakableTestResult` that also includes some of our own fields. In the case of retries, we
  // also clear stats that would otherwise result in double-counted tests being emitted by the
  // SummaryReporter.
  private async onResult(
    attempt: number,
    manifest: TestSuiteManifest | undefined,
    repoRoot: string,
    testsToRetry: TestFailure[],
    test: Test,
    testResult: TestResult
  ): Promise<void> {
    debug(`onResult attempt=${attempt} path=\`${test.path}\``);

    await Promise.all(
      testResult.testResults.map(
        async (assertionResult: UnflakableAssertionResult): Promise<void> => {
          const testFilename = toPosix(path.relative(repoRoot, test.path));

          const key = JSON.stringify(testKey(assertionResult, false));
          if (this.capturedOutput[key] !== undefined) {
            assertionResult._unflakableCapturedStderr =
              this.capturedOutput[key].stderr;
            assertionResult._unflakableCapturedStdout =
              this.capturedOutput[key].stdout;
          }

          delete this.capturedOutput[key];

          if (assertionResult.status === FAILED) {
            try {
              assertionResult._unflakableIsFailureTestIndependent =
                await this.isFailureTestIndependent(
                  testResult.testFilePath,
                  assertionResult
                );
              debug(
                `Failure is${
                  assertionResult._unflakableIsFailureTestIndependent === true
                    ? ""
                    : " not"
                } test independent`
              );
            } catch (e) {
              process.stderr.write(
                chalk.red(
                  `ERROR: Failed to evaluate isFailureTestIndependent: ${util.inspect(
                    e
                  )}\n`
                )
              );
            }

            if (manifest === undefined) {
              debug(
                "Not quarantining test failure due to failure to fetch manifest"
              );
            } else if (
              this.unflakableConfig.quarantineMode === "no_quarantine"
            ) {
              debug(
                "Not quarantining test failure because quarantineMode is set to `no_quarantine`"
              );
            } else {
              const isQuarantined = isTestQuarantined(
                manifest,
                testFilename,
                testKey(assertionResult, true)
              );
              debug(
                `Test is ${
                  isQuarantined ? "" : "NOT "
                }quarantined: ${JSON.stringify(
                  testKey(assertionResult, false)
                )} in file ${testFilename}`
              );

              // Use a separate field instead of adding a new `status` to avoid confusing third-
              // party code that consumes the `Status` enum.
              assertionResult._unflakableIsQuarantined = isQuarantined;
            }
          }
        }
      )
    );

    // We don't treat test-independent failures as failing tests at this point because that would
    // cause Jest to terminate with a non-zero exit code, and we don't know yet if any subsequent
    // attempts will pass.
    const numFailingTests = testResult.testResults.filter(
      (assertionResult: UnflakableAssertionResult) =>
        assertionResult.status === FAILED &&
        assertionResult._unflakableIsQuarantined !== true &&
        assertionResult._unflakableIsFailureTestIndependent !== true
    ).length;

    // We retry any type of failure, including quarantined and test-independent failures.
    if (
      testResult.testResults.some(
        (assertionResult) => assertionResult.status === FAILED
      )
    ) {
      testsToRetry.push({ test, testResult });
    }

    (testResult as UnflakableTestResult)._unflakableAttempt = attempt;
    if (attempt === 0) {
      // NB: If this value is non-zero, the whole Jest run will terminate with a non-zero exit
      // code.
      testResult.numFailingTests = numFailingTests;
    } else {
      // Don't double-count retried tests or SummaryReporter will produce confusing results.
      testResult.numFailingTests = 0;
      testResult.numPassingTests = 0;
      testResult.numPendingTests = 0;
      testResult.numTodoTests = 0;
    }
  }

  // FIXME: test what happens when running Jest with multiple --projects arguments. Jest seems to
  // create a separate "context" per project and associate that context with each test in the
  // project.

  // EmittingTestRunnerInterface in Jest 28+.
  async runTests(
    tests: Array<Test>,
    watcher: TestWatcher,
    options: TestRunnerOptions
  ): Promise<void>;
  // CallbackTestRunnerInterface in Jest 28+, and any version < Jest 28.
  async runTests(
    tests: Array<Test>,
    watcher: TestWatcher,
    onStart: OnTestStart,
    onResult: OnTestSuccess,
    onFailure: OnTestFailure,
    options: TestRunnerOptions
  ): Promise<void>;
  async runTests(
    tests: Array<Test>,
    watcher: TestWatcher,
    onStartOrOptions: OnTestStart | TestRunnerOptions,
    onResult?: OnTestSuccess,
    onFailure?: OnTestFailure,
    options?: TestRunnerOptions
  ): Promise<void> {
    debug("runTests");
    const repoRoot =
      this.unflakableConfig.enabled && this.unflakableConfig.gitAutoDetect
        ? await (async (): Promise<string> => {
            const git = await loadGitRepo();
            return git !== null
              ? await getRepoRoot(git)
              : this.globalConfig.rootDir;
          })()
        : this.globalConfig.rootDir;

    let testsToRetry = await this.runTestsImpl(
      tests,
      watcher,
      onResult !== undefined ? (onStartOrOptions as OnTestStart) : undefined,
      onResult,
      onFailure,
      onResult !== undefined
        ? (options as TestRunnerOptions)
        : (onStartOrOptions as TestRunnerOptions),
      repoRoot,
      this.globalConfig,
      0 // attempt
    );

    const attempts =
      this.unflakableConfig.enabled && this.unflakableConfig.failureRetries > 0
        ? this.unflakableConfig.failureRetries + 1
        : 1;
    // NB: jest-circus also supports failure retries, but it's configured via the `jest` object
    // in each test file's environment, not via the global config that we have control over.
    for (
      let attempt = 1;
      testsToRetry.length !== 0 && attempt < attempts;
      attempt++
    ) {
      const numTestsToRetry = testsToRetry.reduce(
        (count, { testResult }) =>
          count +
          testResult.testResults.filter(
            // NB: We retry all failed tests, but quarantined and test-independent failures
            // aren't counted in numFailingTests.
            (assertion) => assertion.status === "failed"
          ).length,
        0
      );
      process.stderr.write(
        chalk.stderr.yellow.bold(
          `Retrying ${numTestsToRetry} failed test${
            numTestsToRetry === 1 ? "" : "s"
          } from ${testsToRetry.length} file${
            testsToRetry.length === 1 ? "" : "s"
          } -- ${attempts - attempt - 1} ${
            attempts - attempt - 1 === 1 ? "retry" : "retries"
          } remaining`
        ) + "\n"
      );

      // Similar to how we skip quarantined tests when quarantineMode is "skip_tests", we need to
      // re-run each failed file separately so that we can pass a custom testNamePattern regex to
      // each. This ensures that we only rerun the failed tests in each file.
      testsToRetry = await testsToRetry.reduce(
        (promise, { test, testResult }) =>
          promise.then(async (newTestsToRetry) => {
            const failedTestPattern = testResult.testResults
              .filter(
                (assertionResult: UnflakableAssertionResult) =>
                  assertionResult.status === FAILED
              )
              .map((failedTest) => {
                const testId = testKey(failedTest, false);
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
            return newTestsToRetry.concat(
              await this.runTestsImpl(
                [test],
                watcher,
                onResult !== undefined
                  ? (onStartOrOptions as OnTestStart)
                  : undefined,
                // We re-wrap it in the next iteration.
                onResult,
                onFailure,
                onResult !== undefined
                  ? (options as TestRunnerOptions)
                  : (onStartOrOptions as TestRunnerOptions),
                repoRoot,
                filteredGlobalConfig,
                attempt
              )
            );
          }),
        Promise.resolve([] as TestFailure[])
      );
    }
  }

  // Returns an array of tests that should be retried, which includes both quarantined and
  // test-independent failures.
  private async runTestsImpl(
    tests: Test[],
    watcher: TestWatcher,
    onStart: OnTestStart | undefined,
    onResult: OnTestSuccess | undefined,
    onFailure: OnTestFailure | undefined,
    options: TestRunnerOptions,
    repoRoot: string,
    globalConfig: Config.GlobalConfig,
    attempt: number
  ): Promise<TestFailure[]> {
    debug("runTestsImpl");
    const testsToRetry: TestFailure[] = [];
    const manifest = await this.manifest;

    const runTests = async (
      globalConfig: Config.GlobalConfig,
      tests: Array<Test>,
      watcher: TestWatcher,
      options: TestRunnerOptions
    ): Promise<void> => {
      const testRunner = new TestRunner(globalConfig, this.context ?? {});

      const onResultImpl =
        onResult !== undefined && this.unflakableConfig.enabled
          ? async (test: Test, result: TestResult): Promise<void> => {
              // NB: We call this first because it modifies `result`.
              await this.onResult(
                attempt,
                manifest,
                repoRoot,
                testsToRetry,
                test,
                result
              );
              await onResult(test, result);
            }
          : onResult;

      // The event emitter interface was introduced in Jest 26.2.0 (see
      // https://github.com/facebook/jest/pull/10227).
      if ((testRunner as unknown as { on?: unknown }).on !== undefined) {
        const eventEmittingTestRunner = testRunner as unknown as {
          on: <Name extends keyof TestEvents>(
            eventName: Name,
            listener: (eventData: TestEvents[Name]) => void | Promise<void>
          ) => UnsubscribeFn;
        };

        // EmittingTestRunnerInterface in Jest 28+.
        const supportsEventEmitters = (
          testRunner as {
            supportsEventEmitters?: boolean;
          }
        ).supportsEventEmitters;

        const unsubscribes = [
          ...(onStart !== undefined
            ? [
                eventEmittingTestRunner.on(
                  "test-file-start",
                  ([test]: [Test]) => onStart(test)
                ),
              ]
            : []),
          ...(onResultImpl !== undefined
            ? [
                eventEmittingTestRunner.on(
                  "test-file-success",
                  ([test, result]: [Test, TestResult]) =>
                    onResultImpl(test, result)
                ),
              ]
            : []),
          ...(onFailure !== undefined
            ? [
                eventEmittingTestRunner.on(
                  "test-file-failure",
                  ([test, error]: [Test, SerializableError]) =>
                    onFailure(test, error)
                ),
              ]
            : []),
          ...(supportsEventEmitters === true
            ? [
                eventEmittingTestRunner.on(
                  "test-case-result",
                  ([testPath, assertionResult]: [
                    string,
                    UnflakableAssertionResult
                  ]): void => {
                    debug(
                      `on(test-case-result) path=\`${testPath}\` title=%o status=%o`,
                      [
                        ...assertionResult.ancestorTitles,
                        assertionResult.title,
                      ],
                      assertionResult.status
                    );

                    this.capturedOutput[
                      JSON.stringify(testKey(assertionResult, false))
                    ] = {
                      stdout: assertionResult._unflakableCapturedStdout ?? "",
                      stderr: assertionResult._unflakableCapturedStderr ?? "",
                    };
                  }
                ),
              ]
            : []),
          ...Object.entries(this.testEventHandlers).flatMap(
            ([eventName, listeners]) =>
              listeners.map((listener) => {
                if (
                  eventName === "test-file-success" &&
                  this.unflakableConfig.enabled
                ) {
                  return eventEmittingTestRunner.on(
                    "test-file-success",
                    async ([
                      test,
                      result,
                    ]: TestEvents["test-file-success"]): Promise<void> => {
                      // NB: We call this first because it modifies `result`.
                      await this.onResult(
                        attempt,
                        manifest,
                        repoRoot,
                        testsToRetry,
                        test,
                        result
                      );
                      // NB: This triggers Jest's ReporterDispatcher to call onTestResult() for each
                      // reporter.
                      return (
                        listener as (
                          eventData: TestEvents["test-file-success"]
                        ) => void | Promise<void>
                      )([test, result]);
                    }
                  );
                } else {
                  return eventEmittingTestRunner.on(
                    eventName as keyof TestEvents,
                    listener as (
                      eventData: TestEvents[keyof TestEvents]
                    ) => void | Promise<void>
                  );
                }
              })
          ),
        ];

        await (supportsEventEmitters === true
          ? // EmittingTestRunnerInterface in Jest 28+.
            (
              testRunner.runTests as unknown as (
                tests: Array<Test>,
                watcher: TestWatcher,
                options: TestRunnerOptions
              ) => Promise<void>
            )(tests, watcher, options)
          : (
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
            ));

        unsubscribes.forEach((unsubscribe) => unsubscribe());
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
      this.unflakableConfig.enabled &&
      this.unflakableConfig.quarantineMode === "skip_tests"
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
          const relPath = toPosix(path.relative(repoRoot, test.path));
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
            (test) =>
              !(
                toPosix(path.relative(repoRoot, test.path)) in
                quarantinedTestsByFile
              )
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
    return testsToRetry;
  }
}

export default UnflakableRunner;
