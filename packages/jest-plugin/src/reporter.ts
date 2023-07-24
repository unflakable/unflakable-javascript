// Copyright (c) 2022-2023 Developer Innovations, LLC

import * as path from "path";
import type {
  AggregatedResult,
  AssertionResult,
  Status,
} from "@jest/test-result";
import {
  BaseReporter,
  DefaultReporter,
  ReporterOnStartOptions,
  Test,
  VerboseReporter,
} from "@jest/reporters";
import { groupBy, testKey, USER_AGENT } from "./utils";
import {
  TestAttemptResult,
  TestRunRecord,
  createTestSuiteRun,
  testSuiteRunUrl,
} from "@unflakable/js-api";
import {
  UnflakableAggregatedResult,
  UnflakableAggregatedResultWithCounts,
  UnflakableAssertionResult,
  UnflakableJestConfig,
  UnflakableTestResult,
  UnflakableTestResultWithCounts,
} from "./types";
import { specialChars } from "jest-util";
import type { Config } from "@jest/types";
import { getConsoleOutput } from "@jest/console";
import chalk from "chalk";
import { debug as _debug } from "debug";
import SummaryReporter from "./vendored/SummaryReporter";
import { getResultHeader } from "./vendored/getResultHeader";
import { formatTime } from "./vendored/formatTime";
import {
  autoDetectGit,
  branchOverride,
  commitOverride,
  getRepoRoot,
  loadApiKey,
  loadGitRepo,
  toPosix,
  UnflakableConfigEnabled,
} from "@unflakable/plugins-common";
import { loadConfig } from "./config";
import { addResult, makeEmptyAggregatedTestResult } from "@jest/test-result";

const debug = _debug("unflakable:reporter");

const TITLE_BULLET = chalk.bold("\u25cf ");

const jestStatusToUnflakableApi = (
  status: Status,
  isQuarantined: boolean
): TestAttemptResult | undefined => {
  if (isQuarantined) {
    return "quarantined";
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
  switch (status as Status | "focused") {
    // Introduced in Jest 29.4 (see https://github.com/facebook/jest/pull/13700).
    case "focused":
    case "passed":
      return "pass";
    case "failed":
      return "fail";
    case "skipped":
    case "pending":
    case "todo":
    case "disabled":
      return undefined;
  }
};

const getIcon = (test: UnflakableAssertionResult): string => {
  if (test._unflakableIsQuarantined === true) {
    return chalk.yellow(specialChars.ICONS.failed);
  } else {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    switch (test.status as Status | "focused") {
      case "failed":
        return chalk.red(specialChars.ICONS.failed);
      case "pending":
        return chalk.yellow(specialChars.ICONS.pending);
      case "todo":
        return chalk.magenta(specialChars.ICONS.todo);
      // Introduced in Jest 29.4 (see https://github.com/facebook/jest/pull/13700).
      case "focused":
      case "passed":
      case "skipped":
      case "disabled":
        return chalk.green(specialChars.ICONS.success);
    }
  }
};

// Recomputes the aggregated stats after taking into account retries, flakes, quarantine, and
// test-independent failures. This function returns new objects and does NOT modify its input.
const computeResultsForReporter = (
  origAggregatedResults: UnflakableAggregatedResult
): UnflakableAggregatedResultWithCounts => {
  const resultsByFilenameAndName = Object.fromEntries(
    Object.entries(
      groupBy(
        origAggregatedResults.testResults,
        (testFileResult: UnflakableTestResult) => testFileResult.testFilePath
      )
    ).map(([testFilePath, testFileResults]) => [
      testFilePath,
      groupBy(
        testFileResults.flatMap((testFileResult) => testFileResult.testResults),
        (assertionResult) => JSON.stringify(testKey(assertionResult, false))
      ),
    ])
  );

  // Only includes the first attempt of each test file, but the stats take into account subsequent
  // attempts to determine flakiness and test-independence.
  const updatedTestResults: UnflakableTestResultWithCounts[] =
    origAggregatedResults.testResults
      .filter((testResult) => (testResult._unflakableAttempt ?? 0) === 0)
      .map((testResult): UnflakableTestResultWithCounts => {
        const attemptsByTestName =
          resultsByFilenameAndName[testResult.testFilePath];

        const {
          numFailingTests,
          numFlakyTests,
          numPassingTests,
          numPassingTestsWithIndependentFailures,
          numQuarantinedTests,
        } = testResult.testResults.reduce(
          (
            {
              numFailingTests,
              numFlakyTests,
              numPassingTests,
              numPassingTestsWithIndependentFailures,
              numQuarantinedTests,
            },
            assertionResult
          ) => {
            const attempts =
              attemptsByTestName[
                JSON.stringify(testKey(assertionResult, false))
              ];
            const isPassing =
              attempts.some((attempt) => attempt.status === "passed") &&
              attempts.every(
                (attempt) =>
                  attempt.status === "passed" ||
                  attempt.status === "pending" ||
                  attempt._unflakableIsFailureTestIndependent === true
              );
            const isPassingWithTestIndependentFailures =
              isPassing &&
              attempts.some(
                (attempt) =>
                  attempt.status === "failed" &&
                  attempt._unflakableIsFailureTestIndependent === true
              );
            const isQuarantined =
              !isPassing &&
              attempts.some(
                (attempt) =>
                  attempt.status === "failed" &&
                  attempt._unflakableIsQuarantined === true
              );
            const isFlaky =
              !isQuarantined &&
              attempts.some((attempt) => attempt.status === "passed") &&
              attempts.some(
                (attempt) =>
                  attempt.status === "failed" &&
                  attempt._unflakableIsFailureTestIndependent !== true &&
                  attempt._unflakableIsQuarantined !== true
              );
            const isFailing =
              !isQuarantined &&
              attempts.some((attempt) => attempt.status === "failed") &&
              attempts.every(
                (attempt) =>
                  attempt.status === "failed" || attempt.status === "pending"
              );
            return {
              numFailingTests: numFailingTests + (isFailing ? 1 : 0),
              numFlakyTests: numFlakyTests + (isFlaky ? 1 : 0),
              numPassingTests: numPassingTests + (isPassing ? 1 : 0),
              numPassingTestsWithIndependentFailures:
                numPassingTestsWithIndependentFailures +
                (isPassingWithTestIndependentFailures ? 1 : 0),
              numQuarantinedTests:
                numQuarantinedTests + (isQuarantined ? 1 : 0),
            };
          },
          {
            numFailingTests: 0,
            numFlakyTests: 0,
            numPassingTests: 0,
            numPassingTestsWithIndependentFailures: 0,
            numQuarantinedTests: 0,
          }
        );

        return {
          ...testResult,
          numFailingTests,
          numPassingTests,
          _unflakableNumFlakyTests: numFlakyTests,
          _unflakableNumQuarantinedTests: numQuarantinedTests,
          _unflakableNumPassingTestsWithIndependentFailures:
            numPassingTestsWithIndependentFailures,
        };
      });

  const emptyAggregatedResults: UnflakableAggregatedResultWithCounts = {
    ...makeEmptyAggregatedTestResult(),

    // Jest sets these fields separately in its TestScheduler:
    // https://github.com/jestjs/jest/blob/7cf50065ace0f0fffeb695a7980e404a17d3b761/packages/jest-core/src/TestScheduler.ts#L429
    numTotalTestSuites: origAggregatedResults.numTotalTestSuites,
    startTime: origAggregatedResults.startTime,
    success: origAggregatedResults.success,

    testResults: updatedTestResults,
    _unflakableNumFlakyTests: 0,
    _unflakableNumQuarantinedTests: 0,
    _unflakableNumQuarantinedSuites: 0,
    _unflakableNumPassedTestsWithIndependentFailures: 0,
    _unflakableNumPassedTestSuitesWithIndependentFailures: 0,
  };

  return updatedTestResults.reduce((aggregatedResults, testResult) => {
    const prevNumPassedTestSuites = aggregatedResults.numPassedTestSuites;
    addResult(aggregatedResults, testResult);

    aggregatedResults.numTotalTests +=
      testResult._unflakableNumFlakyTests +
      testResult._unflakableNumQuarantinedTests;

    aggregatedResults._unflakableNumFlakyTests +=
      testResult._unflakableNumFlakyTests;
    aggregatedResults._unflakableNumQuarantinedTests +=
      testResult._unflakableNumQuarantinedTests;

    aggregatedResults._unflakableNumPassedTestsWithIndependentFailures +=
      testResult._unflakableNumPassingTestsWithIndependentFailures;

    if (aggregatedResults.numPassedTestSuites > prevNumPassedTestSuites) {
      // Handle edge cases that onResult() considers a suite pass but that should be failed or
      // quarantined:
      // https://github.com/jestjs/jest/blob/6d2632adae0f0fa1fe116d3b475fd9783d0de1b5/packages/jest-test-result/src/helpers.ts#L110
      if (testResult._unflakableNumFlakyTests > 0) {
        aggregatedResults.numFailedTestSuites += 1;
        aggregatedResults.numPassedTestSuites -= 1;
      } else if (testResult._unflakableNumQuarantinedTests > 0) {
        aggregatedResults._unflakableNumQuarantinedSuites += 1;
        aggregatedResults.numPassedTestSuites -= 1;
      } else if (
        testResult._unflakableNumPassingTestsWithIndependentFailures > 0
      ) {
        aggregatedResults._unflakableNumPassedTestSuitesWithIndependentFailures++;
      }
    }

    return aggregatedResults;
  }, emptyAggregatedResults);
};

export default class UnflakableReporter extends BaseReporter {
  private readonly apiKey: string;
  private readonly unflakableConfig: UnflakableJestConfig;

  private readonly rootDir: string;
  private readonly defaultReporter: DefaultReporter & {
    // Not defined in Jest < 26.2.
    onTestCaseResult?: (test: Test, testCaseResult: AssertionResult) => void;
  };
  private readonly summaryReporter: SummaryReporter;

  constructor(globalConfig: Config.GlobalConfig) {
    debug("constructor");
    super();
    this.rootDir = globalConfig.rootDir;
    this.unflakableConfig = loadConfig(globalConfig.rootDir);
    this.apiKey = this.unflakableConfig.enabled ? loadApiKey() : "";

    if (globalConfig.verbose === true) {
      const verboseReporter = new VerboseReporter(globalConfig);
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: monkey patch to avoid full re-implementation of VerboseReporter.
      if (verboseReporter._logTest === undefined) {
        throw new Error(
          "incompatible Jest version: @jest/reporters/VerboseReporter does not contain a " +
            "_logTest method"
        );
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore: monkey patch to avoid full re-implementation of VerboseReporter.
      } else if (verboseReporter._logLine === undefined) {
        throw new Error(
          "incompatible Jest version: @jest/reporters/VerboseReporter does not contain a " +
            "_logLine method"
        );
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore: monkey patch to avoid full re-implementation of VerboseReporter.
      verboseReporter._logTest = (
        assertionResult: UnflakableAssertionResult,
        indentLevel: number
      ): void => {
        const status = getIcon(assertionResult);
        const duration = assertionResult.duration ?? 0;
        const time =
          duration > 0 ? ` (${formatTime(Math.round(duration))})` : "";

        // prettier-ignore
        (
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore: monkey patch to avoid full re-implementation of VerboseReporter.
          verboseReporter._logLine as (
            str?: string,
            indentLevel?: number
          ) => void
        )(
          status +
          " " +
          chalk.dim(
            assertionResult.title +
            (assertionResult._unflakableIsFailureTestIndependent === true
              ? chalk.red(" [test independent]")
              : "") +
            (assertionResult._unflakableIsQuarantined === true
              ? chalk.yellow(" [quarantined]")
              : "") +
            time
          ),
          indentLevel
        );
      };
      this.defaultReporter = verboseReporter;
    } else {
      this.defaultReporter = new DefaultReporter(globalConfig);
    }

    this.defaultReporter.printTestFileHeader = (
      _testPath: unknown,
      config: Config.ProjectConfig,
      result: UnflakableTestResultWithCounts
    ): void => {
      const resultHeader = getResultHeader(result, globalConfig, config);

      // getResultHeader() includes optional functionality such as printing memory usage and perf
      // stats. To avoid duplicating that functionality, which seems likely to change over time, we
      // instead parse the result replace the status if the test is quarantined.
      if (
        result.testExecError === undefined &&
        result.numFailingTests !== 0 &&
        result.numFailingTests === result._unflakableNumQuarantinedTests
      ) {
        this.defaultReporter.log(
          (chalk.supportsColor !== false
            ? chalk.reset.inverse.bold.yellow(` QUARANTINED `)
            : "QUARANTINED") +
            " " +
            resultHeader
        );
      } else {
        this.defaultReporter.log(resultHeader);
      }
      if (result.console !== undefined) {
        this.log(
          "  " +
            TITLE_BULLET +
            "Console\n\n" +
            (getConsoleOutput.length === 3
              ? // Jest v27 (breaking change made in https://github.com/facebook/jest/pull/10126)
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore: ignore type checks since this needs to support multiple versions
                getConsoleOutput(result.console, config, globalConfig)
              : // Jest v26
                getConsoleOutput(
                  config.cwd,
                  globalConfig.verbose === true,
                  result.console,
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore: ignore type checks since this needs to support multiple versions
                  config
                ))
        );
      }
    };

    // To avoid the cost of maintaining a full, modified implementation of SummaryReporter, we
    // instead invoke the unmodified SummaryReporter and then print additional information below it.
    this.summaryReporter = new SummaryReporter(globalConfig);
  }

  onRunStart(
    aggregatedResults: AggregatedResult,
    options: ReporterOnStartOptions
  ): void {
    debug("onRunStart");
    this.defaultReporter.onRunStart(aggregatedResults, options);
    this.summaryReporter.onRunStart(aggregatedResults, options);
  }

  onTestStart(test: Test): void {
    debug("onTestStart");
    this.defaultReporter.onTestStart(test);
  }

  onTestCaseResult(
    test: Test,
    assertionResult: UnflakableAssertionResult
  ): void {
    debug(
      `onTestCaseResult path=\`${test.path}\` title=%o status=%o`,
      [...assertionResult.ancestorTitles, assertionResult.title],
      assertionResult.status
    );

    // Not defined in Jest < 26.2.
    if (this.defaultReporter.onTestCaseResult !== undefined) {
      this.defaultReporter.onTestCaseResult(test, assertionResult);
    }
  }

  // NB: This is called once per test *file* attempt, but the aggregatedResults include every test
  // attempt so far, including those from other files.
  onTestResult(
    test: Test,
    testResult: UnflakableTestResult,
    aggregatedResults: UnflakableAggregatedResult
  ): void {
    debug(`onTestResult path=\`${test.path}\``);

    const testResultForReporter: UnflakableTestResultWithCounts = {
      ...testResult,
      // Undo the sanitization of quarantined tests that the runner performs in order to keep
      // Jest from exiting with non-zero status if all the failed tests are quarantined. This needs
      // to be non-zero if there are any quarantined tests so that
      // DefaultReporter.printTestFileHeader() prints FAIL for this file (preceded by QUARANTINED
      // if all of the failures are quarantined).
      numFailingTests: testResult.testResults.filter(
        (assertionResult) => assertionResult.status === "failed"
      ).length,
      // We don't know when tests are flaky until the end.
      _unflakableNumFlakyTests: 0,
      _unflakableNumPassingTestsWithIndependentFailures: 0,
      _unflakableNumQuarantinedTests: testResult.testResults.filter(
        (attempt) =>
          attempt.status === "failed" &&
          attempt._unflakableIsQuarantined === true
      ).length,
      snapshot: {
        ...testResult.snapshot,
        // When we retry failed tests, Jest incorrectly counts named snapshots as obsolete. Filter
        // out obsolete tests during retries.
        unchecked:
          (testResult._unflakableAttempt ?? 0) > 0
            ? 0
            : testResult.snapshot.unchecked,
        uncheckedKeys:
          (testResult._unflakableAttempt ?? 0) > 0
            ? []
            : testResult.snapshot.uncheckedKeys,
      },
    };

    this.defaultReporter.onTestResult(
      test,
      testResultForReporter,
      computeResultsForReporter(aggregatedResults)
    );
  }

  // NB: This is called only once, after UnflakableRunner.runTests() returns (i.e., after all
  // retries have been exhausted or all tests passed). The aggregatedResults include every test
  // attempt.
  async onRunComplete(
    contexts: Set<unknown> | undefined,
    aggregatedResults: UnflakableAggregatedResult
  ): Promise<void> {
    debug("onRunComplete");
    this.defaultReporter.onRunComplete();

    // Don't double-count tests that were retried.
    this.summaryReporter.onRunComplete(
      contexts,
      computeResultsForReporter(aggregatedResults)
    );

    if (this.unflakableConfig.enabled && this.unflakableConfig.uploadResults) {
      await this.uploadResults(aggregatedResults, this.unflakableConfig);
    } else if (!this.unflakableConfig.enabled) {
      debug("Not reporting results to Unflakable because plugin is disabled");
    } else {
      debug(
        "Not reporting results to Unflakable because configuration option `uploadResults` is false"
      );
    }
  }

  private async uploadResults(
    aggregatedResults: AggregatedResult,
    unflakableConfig: UnflakableConfigEnabled
  ): Promise<void> {
    const testSuiteId = unflakableConfig.testSuiteId;

    const git = unflakableConfig.gitAutoDetect ? await loadGitRepo() : null;
    const repoRoot = git !== null ? await getRepoRoot(git) : this.rootDir;

    const results = Object.entries(
      groupBy(
        aggregatedResults.testResults,
        (testFileResult: UnflakableTestResult) => testFileResult.testFilePath
      )
    ).flatMap(([testFilePath, testFileResults]): TestRunRecord[] =>
      Object.entries(
        groupBy(
          testFileResults.flatMap(
            (testFileResult) => testFileResult.testResults
          ),
          (assertionResult) => JSON.stringify(testKey(assertionResult, true))
        )
      )
        .map(
          ([, assertionResults]): TestRunRecord => ({
            filename: toPosix(path.relative(repoRoot, testFilePath)),
            name: testKey(assertionResults[0], true),
            attempts: assertionResults
              .map((testResult: UnflakableAssertionResult) => ({
                testResult,
                result: jestStatusToUnflakableApi(
                  testResult.status,
                  testResult._unflakableIsQuarantined === true
                ),
              }))
              .filter(({ result }) => result !== undefined)
              .map(({ testResult, result }) => ({
                duration_ms:
                  testResult.duration !== null &&
                  testResult.duration !== undefined
                    ? Math.floor(testResult.duration)
                    : undefined,
                result: result as NonNullable<typeof result>,
                ...((result === "fail" || result === "quarantined") &&
                testResult._unflakableIsFailureTestIndependent === true
                  ? {
                      failure_reason: "independent",
                    }
                  : {}),
              })),
          })
        )
        // Don't bother reporting skipped tests
        .filter((runRecord) => runRecord.attempts.length > 0)
    );

    if (results.length === 0) {
      debug("No results to report to Unflakable");
      return;
    }

    let branch = branchOverride.value,
      commit = commitOverride.value;

    if (
      git !== null &&
      (branch === undefined ||
        branch.length === 0 ||
        commit === undefined ||
        commit.length === 0)
    ) {
      const { branch: gitBranch, commit: gitCommit } = await autoDetectGit(
        git,
        this.log.bind(this)
      );

      if (branch === undefined || branch.length === 0) {
        branch = gitBranch;
      }
      if (commit === undefined || commit.length === 0) {
        commit = gitCommit;
      }
    }

    debug("Reporting results to Unflakable");
    const testSuiteRun = await createTestSuiteRun({
      request: {
        branch,
        commit,
        start_time: new Date(aggregatedResults.startTime).toISOString(),
        end_time: new Date(Date.now()).toISOString(),
        test_runs: results,
      },
      testSuiteId,
      apiKey: this.apiKey,
      baseUrl: unflakableConfig.apiBaseUrl,
      clientDescription: USER_AGENT,
    }).catch((e) =>
      Promise.reject(
        new Error(`failed to report results to Unflakable: ${e as string}`)
      )
    );

    this.log(
      "Unflakable report: " +
        testSuiteRunUrl(
          testSuiteRun.suite_id,
          testSuiteRun.run_id,
          unflakableConfig.apiBaseUrl
        )
    );
  }
}
