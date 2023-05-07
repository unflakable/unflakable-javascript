// Copyright (c) 2022-2023 Developer Innovations, LLC

/*
This file includes portions of a Jest source code file originally downloaded from:
https://github.com/facebook/jest/blob/v26.6.3/packages/jest-reporters/src/utils.ts. Its copyright
notice and license are as follows:

    MIT License

    Copyright (c) Facebook, Inc. and its affiliates.

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

All modifications to the above referenced file are copyrighted and licensed under the terms set
forth in the LICENSE file at the root of this repository.
*/

import type { SummaryOptions, Test } from "@jest/reporters";
import {
  UnflakableAggregatedResult,
  UnflakableAssertionResult,
  UnflakableTestResult,
} from "../types";
import * as JestUtil from "jest-util";
import type { AssertionResult } from "@jest/test-result";
import chalk from "chalk";
import { formatTime } from "./formatTime";

const PROGRESS_BAR_WIDTH = 40;

const getValuesCurrentTestCases = (
  currentTestCases: {
    test: Test;
    testCaseResult: UnflakableAssertionResult;
  }[] = []
): {
  numFailingTests: number;
  numPassingTests: number;
  numPendingTests: number;
  numQuarantinedTests: number;
  numTodoTests: number;
  numTotalTests: number;
} => {
  let numFailingTests = 0;
  let numPassingTests = 0;
  let numPendingTests = 0;
  let numQuarantinedTests = 0;
  let numTodoTests = 0;
  let numTotalTests = 0;
  currentTestCases.forEach((testCase) => {
    if (testCase.testCaseResult._unflakableIsQuarantined === true) {
      numQuarantinedTests++;
    } else {
      switch (testCase.testCaseResult.status) {
        case "failed":
          numFailingTests++;
          break;
        case "passed":
          numPassingTests++;
          break;
        case "skipped":
          numPendingTests++;
          break;
        case "todo":
          numTodoTests++;
          break;
        default:
          break;
      }
    }
    numTotalTests++;
  });

  return {
    numFailingTests,
    numPassingTests,
    numPendingTests,
    numQuarantinedTests,
    numTodoTests,
    numTotalTests,
  };
};

const renderTime = (
  runTime: number,
  estimatedTime: number,
  width: number
): string => {
  // If we are more than one second over the estimated time, highlight it.
  const renderedTime =
    estimatedTime > 0 && runTime >= estimatedTime + 1
      ? chalk.bold.yellow(formatTime(runTime, 0))
      : formatTime(runTime, 0);
  let time = chalk.bold(`Time:`) + `        ${renderedTime}`;
  if (runTime < estimatedTime) {
    time += `, estimated ${formatTime(estimatedTime, 0)}`;
  }

  // Only show a progress bar if the test run is actually going to take
  // some time.
  if (estimatedTime > 2 && runTime < estimatedTime && width > 0) {
    const availableWidth = Math.min(PROGRESS_BAR_WIDTH, width);
    const length = Math.min(
      Math.floor((runTime / estimatedTime) * availableWidth),
      availableWidth
    );
    if (availableWidth >= 2) {
      time +=
        "\n" +
        chalk.green("█").repeat(length) +
        chalk.white("█").repeat(availableWidth - length);
    }
  }
  return time;
};

export const getSummary = (
  aggregatedResults: UnflakableAggregatedResult,
  options?: SummaryOptions
): string => {
  let runTime = (Date.now() - aggregatedResults.startTime) / 1000;
  if (options?.roundTime === true) {
    runTime = Math.floor(runTime);
  }

  const valuesForCurrentTestCases = getValuesCurrentTestCases(
    (
      options as {
        // Not defined in Jest < 26.2.
        currentTestCases?:
          | { test: Test; testCaseResult: AssertionResult }[]
          | undefined;
      }
    )?.currentTestCases ?? []
  );

  let suitesQuarantined = 0,
    testsFlaky = 0,
    testsQuarantined = 0;
  aggregatedResults.testResults.forEach((testResult: UnflakableTestResult) => {
    testsFlaky += testResult._unflakableNumFlakyTests ?? 0;
    testsQuarantined += testResult._unflakableNumQuarantinedTests ?? 0;
    if (
      !testResult.skipped &&
      testResult.numFailingTests === 0 &&
      testResult.testExecError === undefined &&
      (testResult._unflakableNumQuarantinedTests ?? 0) > 0
    ) {
      suitesQuarantined += 1;
    }
  });

  const estimatedTime = options?.estimatedTime ?? 0;
  const snapshotResults = aggregatedResults.snapshot;
  const snapshotsAdded = snapshotResults.added;
  const snapshotsFailed = snapshotResults.unmatched;
  const snapshotsOutdated = snapshotResults.unchecked;
  const snapshotsFilesRemoved = snapshotResults.filesRemoved;
  const snapshotsDidUpdate = snapshotResults.didUpdate;
  const snapshotsPassed = snapshotResults.matched;
  const snapshotsTotal = snapshotResults.total;
  const snapshotsUpdated = snapshotResults.updated;
  const suitesFailed = aggregatedResults.numFailedTestSuites;
  const suitesPassed =
    aggregatedResults.numPassedTestSuites - suitesQuarantined;
  const suitesPending = aggregatedResults.numPendingTestSuites;
  const suitesRun = suitesFailed + suitesPassed + suitesQuarantined;
  const suitesTotal = aggregatedResults.numTotalTestSuites;
  const testsFailed = aggregatedResults.numFailedTests;
  const testsPassed = aggregatedResults.numPassedTests;
  const testsPending = aggregatedResults.numPendingTests;
  const testsTodo = aggregatedResults.numTodoTests;
  const testsTotal = aggregatedResults.numTotalTests + testsQuarantined;
  const width = options?.width ?? 0;

  const suites = `${chalk.bold("Test Suites: ")}${
    suitesFailed > 0 ? chalk.bold.red(`${suitesFailed} failed`) + ", " : ""
  }${
    suitesQuarantined > 0
      ? chalk.bold.yellow(`${suitesQuarantined} quarantined`) + ", "
      : ""
  }${
    suitesPending > 0
      ? chalk.bold.yellow(`${suitesPending} skipped`) + ", "
      : ""
  }${
    suitesPassed > 0 ? chalk.bold.green(`${suitesPassed} passed`) + ", " : ""
  }${
    suitesRun !== suitesTotal ? `${suitesRun} of ${suitesTotal}` : suitesTotal
  } total`;

  const updatedTestsFailed = Math.max(
    testsFailed + valuesForCurrentTestCases.numFailingTests - testsFlaky,
    0
  );
  const updatedTestsQuarantined =
    testsQuarantined + valuesForCurrentTestCases.numQuarantinedTests;
  const updatedTestsPending =
    testsPending + valuesForCurrentTestCases.numPendingTests;
  const updatedTestsTodo = testsTodo + valuesForCurrentTestCases.numTodoTests;
  const updatedTestsPassed =
    testsPassed + valuesForCurrentTestCases.numPassingTests;
  const updatedTestsTotal =
    testsTotal + valuesForCurrentTestCases.numTotalTests;

  const tests =
    chalk.bold("Tests:       ") +
    (updatedTestsFailed > 0
      ? chalk.bold.red(`${updatedTestsFailed} failed`) + ", "
      : "") +
    (testsFlaky > 0
      ? chalk.bold.magentaBright(`${testsFlaky} flaky`) + ", "
      : "") +
    (updatedTestsQuarantined > 0
      ? chalk.bold.yellow(`${updatedTestsQuarantined} quarantined`) + ", "
      : "") +
    (updatedTestsPending > 0
      ? chalk.bold.yellow(`${updatedTestsPending} skipped`) + ", "
      : "") +
    (updatedTestsTodo > 0
      ? chalk.bold.magenta(`${updatedTestsTodo} todo`) + ", "
      : "") +
    (updatedTestsPassed > 0
      ? chalk.bold.green(`${updatedTestsPassed} passed`) + ", "
      : "") +
    `${updatedTestsTotal} total`;

  const snapshots =
    chalk.bold("Snapshots:   ") +
    (snapshotsFailed > 0
      ? chalk.bold.red(`${snapshotsFailed} failed`) + ", "
      : "") +
    (snapshotsOutdated > 0 && !snapshotsDidUpdate
      ? chalk.bold.yellow(`${snapshotsOutdated} obsolete`) + ", "
      : "") +
    (snapshotsOutdated > 0 && snapshotsDidUpdate
      ? chalk.bold.green(`${snapshotsOutdated} removed`) + ", "
      : "") +
    (snapshotsFilesRemoved > 0 && !snapshotsDidUpdate
      ? chalk.bold.yellow(
          JestUtil.pluralize("file", snapshotsFilesRemoved) + " obsolete"
        ) + ", "
      : "") +
    (snapshotsFilesRemoved > 0 && snapshotsDidUpdate
      ? chalk.bold.green(
          JestUtil.pluralize("file", snapshotsFilesRemoved) + " removed"
        ) + ", "
      : "") +
    (snapshotsUpdated > 0
      ? chalk.bold.green(`${snapshotsUpdated} updated`) + ", "
      : "") +
    (snapshotsAdded > 0
      ? chalk.bold.green(`${snapshotsAdded} written`) + ", "
      : "") +
    (snapshotsPassed > 0
      ? chalk.bold.green(`${snapshotsPassed} passed`) + ", "
      : "") +
    `${snapshotsTotal} total`;

  const time = renderTime(runTime, estimatedTime, width);
  return [suites, tests, snapshots, time].join("\n");
};
