// Copyright (c) 2022 Developer Innovations, LLC

import * as path from "path";
//
import type {
  AggregatedResult,
  AssertionResult,
  Status,
  TestResult,
} from "@jest/test-result";
import {
  BaseReporter,
  DefaultReporter,
  ReporterOnStartOptions,
  Test,
  VerboseReporter,
} from "@jest/reporters";
import {
  FAILED,
  getTestSuiteId,
  groupBy,
  loadConfig,
  testKey,
  USER_AGENT,
} from "./utils";
import {
  TestAttemptResult,
  TestRunRecord,
  createTestSuiteRun,
  testSuiteRunUrl,
  TEST_NAME_ENTRY_MAX_LENGTH,
} from "@unflakable/js-api";
import {
  UnflakableAggregatedResult,
  UnflakableAssertionResult,
  UnflakableConfig,
  UnflakableTestResult,
} from "./types";
import { specialChars } from "jest-util";

import type { Config } from "@jest/types";
import { getConsoleOutput } from "@jest/console";
import simpleGit from "simple-git";

import chalk = require("chalk");
import _debug = require("debug");
import SummaryReporter from "./vendored/SummaryReporter";
import { getResultHeader } from "./vendored/getResultHeader";
import { formatTime } from "./vendored/formatTime";
import { getCurrentGitBranch, getCurrentGitCommit } from "./git";

const debug = _debug("unflakable:reporter");

const TITLE_BULLET = chalk.bold("\u25cf ");

const jestStatusToUnflakableApi = (
  status: Status,
  isQuarantined: boolean
): TestAttemptResult | undefined => {
  if (isQuarantined) {
    return "quarantined";
  }

  switch (status) {
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
    switch (test.status) {
      case "failed":
        return chalk.red(specialChars.ICONS.failed);
      case "pending":
        return chalk.yellow(specialChars.ICONS.pending);
      case "todo":
        return chalk.magenta(specialChars.ICONS.todo);
      case "passed":
      case "skipped":
      case "disabled":
        return chalk.green(specialChars.ICONS.success);
    }
  }
};

// Removes stats attributed to retries (which shouldn't affect the overall stats) and counts flaky
// tests.
const processedResults = (
  aggregatedResults: AggregatedResult
): UnflakableAggregatedResult => {
  const resultsByFilenameAndName = Object.fromEntries(
    Object.entries(
      groupBy(
        aggregatedResults.testResults,
        (testFileResult: UnflakableTestResult) => testFileResult.testFilePath
      )
    ).map(([testFilePath, testFileResults]) => [
      testFilePath,
      groupBy(
        testFileResults.flatMap((testFileResult) => testFileResult.testResults),
        (assertionResult) => JSON.stringify(testKey(assertionResult))
      ),
    ])
  );

  return aggregatedResults.testResults.reduce(
    (filteredResults, testResult: UnflakableTestResult) => {
      if ((testResult._unflakableAttempt ?? 0) > 0) {
        return {
          ...filteredResults,
          numFailedTestSuites:
            testResult.numFailingTests > 0 ||
            testResult.testExecError !== undefined
              ? filteredResults.numFailedTestSuites - 1
              : filteredResults.numFailedTestSuites,
          numPassedTestSuites:
            !testResult.skipped &&
            !(
              testResult.numFailingTests > 0 ||
              testResult.testExecError !== undefined
            )
              ? filteredResults.numPassedTestSuites - 1
              : filteredResults.numPassedTestSuites,
          numPendingTestSuites: testResult.skipped
            ? filteredResults.numPendingTestSuites - 1
            : filteredResults.numPendingTestSuites,
          snapshot: {
            ...filteredResults.snapshot,
            matched:
              filteredResults.snapshot.matched - testResult.snapshot.matched,
            total:
              filteredResults.snapshot.total -
              testResult.snapshot.added -
              testResult.snapshot.matched -
              testResult.snapshot.unmatched -
              testResult.snapshot.updated,
            // When we retry failed tests, Jest incorrectly counts named snapshots as obsolete.
            unchecked:
              filteredResults.snapshot.unchecked -
              testResult.snapshot.unchecked,
            uncheckedKeysByFile: filteredResults.snapshot.uncheckedKeysByFile
              .map((uncheckedSnapshot) => {
                uncheckedSnapshot.keys = uncheckedSnapshot.keys.filter((key) =>
                  testResult.snapshot.uncheckedKeys.includes(key)
                );
                return uncheckedSnapshot;
              })
              .filter((uncheckedSnapshot) => uncheckedSnapshot.keys.length > 0),
            unmatched:
              filteredResults.snapshot.unmatched -
              testResult.snapshot.unmatched,
            filesUnmatched:
              filteredResults.snapshot.filesUnmatched -
              (testResult.snapshot.unmatched > 0 ? 1 : 0),
          },
        };
      } else {
        const attemptsByTestName =
          resultsByFilenameAndName[testResult.testFilePath];
        const numFlakyTests = testResult.testResults.reduce(
          (numFlakyTests, assertionResult) => {
            const attempts =
              attemptsByTestName[JSON.stringify(testKey(assertionResult))];
            return attempts.some((attempt) => attempt.status === "passed") &&
              attempts.some(
                (attempt: UnflakableAssertionResult) =>
                  attempt.status === "failed" &&
                  attempt._unflakableIsQuarantined !== true
              )
              ? numFlakyTests + 1
              : numFlakyTests;
          },
          0
        );
        return {
          ...filteredResults,
          testResults: [
            ...filteredResults.testResults,
            {
              ...testResult,
              numFailingTests: Math.max(
                testResult.numFailingTests - numFlakyTests,
                0
              ),
              _unflakableNumFlakyTests: numFlakyTests,
            },
          ],
        };
      }
    },
    {
      ...aggregatedResults,
      testResults: [] as UnflakableTestResult[],
    }
  );
};

export default class UnflakableReporter extends BaseReporter {
  private readonly apiKey: string;
  private readonly unflakableConfig: UnflakableConfig;

  private readonly cwd: string;
  private readonly defaultReporter: DefaultReporter & {
    // Not defined in Jest < 26.2.
    onTestCaseResult?: (test: Test, testCaseResult: AssertionResult) => void;
  };
  private readonly summaryReporter: SummaryReporter;

  constructor(globalConfig: Config.GlobalConfig) {
    super();
    this.cwd = process.cwd();
    this.unflakableConfig = loadConfig(globalConfig.rootDir);

    if (
      process.env.UNFLAKABLE_API_KEY !== undefined &&
      process.env.UNFLAKABLE_API_KEY !== ""
    ) {
      this.apiKey = process.env.UNFLAKABLE_API_KEY;
    } else if (this.unflakableConfig.enabled) {
      throw new Error(
        "missing required environment variable `UNFLAKABLE_API_KEY`"
      );
    } else {
      this.apiKey = "";
    }

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
        test: UnflakableAssertionResult,
        indentLevel: number
      ) => {
        const status = getIcon(test);
        const duration = test.duration ?? 0;
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
              test.title +
                (test._unflakableIsQuarantined === true
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
      result: UnflakableTestResult
    ) => {
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

  onTestCaseResult(test: Test, testCaseResult: AssertionResult): void {
    debug("onTestCaseResult");
    // Not defined in Jest < 26.2.
    if (this.defaultReporter.onTestCaseResult !== undefined) {
      this.defaultReporter.onTestCaseResult(test, testCaseResult);
    }
  }

  onTestResult(
    test: Test,
    testResult: TestResult,
    aggregatedResult: AggregatedResult
  ): void {
    debug("onTestResult");
    this.defaultReporter.onTestResult(
      test,
      {
        ...testResult,
        // Undo the sanitization of quarantined tests that the runner performs in order to keep
        // Jest from exiting with non-zero status if all the failed tests are quarantined.
        numFailingTests: testResult.testResults.filter(
          (assertionResult) => assertionResult.status === FAILED
        ).length,
        snapshot: {
          ...testResult.snapshot,
          // When we retry failed tests, Jest incorrectly counts named snapshots as obsolete. Filter
          // out obsolete tests during retries.
          unchecked:
            ((testResult as UnflakableTestResult)._unflakableAttempt ?? 0) > 0
              ? 0
              : testResult.snapshot.unchecked,
          uncheckedKeys:
            ((testResult as UnflakableTestResult)._unflakableAttempt ?? 0) > 0
              ? []
              : testResult.snapshot.uncheckedKeys,
        },
      },
      processedResults(aggregatedResult)
    );
  }

  async onRunComplete(
    contexts: Set<unknown> | undefined,
    aggregatedResults: AggregatedResult
  ): Promise<void> {
    debug("onRunComplete");
    this.defaultReporter.onRunComplete();

    // Don't double-count tests that were retried.
    this.summaryReporter.onRunComplete(
      contexts,
      processedResults(aggregatedResults)
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
    unflakableConfig: UnflakableConfig
  ): Promise<void> {
    const testSuiteId = getTestSuiteId(unflakableConfig);
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
          (assertionResult) =>
            JSON.stringify(
              testKey({
                ...assertionResult,
                // See explanation below.
                title: assertionResult.title.substring(
                  0,
                  TEST_NAME_ENTRY_MAX_LENGTH
                ),
              })
            )
        )
      )
        .map(
          ([, assertionResults]): TestRunRecord => ({
            filename: path.relative(this.cwd, testFilePath),
            name: testKey({
              ...assertionResults[0],
              // If the last test name entry is too long, truncate it to prevent the backend from
              // filtering it out. This allows us to support, for example, long code snippets passed
              // to eslint.RuleTester. The downside is that if multiple tests share the same prefix,
              // they will be treated as a single test. If one is quarantined, they will all
              // effectively be quarantined. Users may avoid this issue by specifying unique (and
              // ideally human-friendly) names for each test case rather than using a code snippet
              // as the test name.
              //
              // Note that we do *not* truncate long filenames or test name entries other than the
              // last one, nor do we remove test name entries beyond the maximum number of allowed
              // entries. Any of these conditions will result in the backend filtering out the
              // affected tests.
              title: assertionResults[0].title.substring(
                0,
                TEST_NAME_ENTRY_MAX_LENGTH
              ),
            }),
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
              })),
          })
        )
        // Don't bother reporting skipped tests
        .filter((runRecord) => runRecord.attempts.length > 0)
    );

    let branch = process.env.UNFLAKABLE_BRANCH,
      commit = process.env.UNFLAKABLE_COMMIT;

    if (
      unflakableConfig.gitAutoDetect &&
      (branch === undefined ||
        branch.length === 0 ||
        commit === undefined ||
        commit.length === 0)
    ) {
      try {
        const git = simpleGit();
        if (await git.checkIsRepo()) {
          const gitCommit = await getCurrentGitCommit(git);
          if (commit === undefined || commit.length === 0) {
            commit = gitCommit;
          }

          if (branch === undefined || branch.length === 0) {
            branch = await getCurrentGitBranch(git, gitCommit);
          }
        }
      } catch (e) {
        this.log(
          `WARNING: Unflakable failed to auto-detect current git branch and commit: ${
            e as string
          }`
        );
        this.log(
          "HINT: set the UNFLAKABLE_BRANCH and UNFLAKABLE_COMMIT environment variables or " +
            "disable git auto-detection by setting `gitAutoDetect` to `false` in the " +
            "Unflakable config file."
        );
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
