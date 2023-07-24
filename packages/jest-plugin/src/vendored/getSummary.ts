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

import type { SummaryOptions } from "@jest/reporters";
import { UnflakableAggregatedResultWithCounts } from "../types";
import * as JestUtil from "jest-util";
import chalk from "chalk";
import { formatTime } from "./formatTime";

const PROGRESS_BAR_WIDTH = 40;

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
  aggregatedResults: UnflakableAggregatedResultWithCounts,
  options?: SummaryOptions
): string => {
  let runTime = (Date.now() - aggregatedResults.startTime) / 1000;
  if (options?.roundTime === true) {
    runTime = Math.floor(runTime);
  }

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
  const suitesPassed = aggregatedResults.numPassedTestSuites;
  const suitesPassedWithIndependentFailures =
    aggregatedResults._unflakableNumPassedTestSuitesWithIndependentFailures;
  const suitesPending = aggregatedResults.numPendingTestSuites;
  const suitesQuarantined = aggregatedResults._unflakableNumQuarantinedSuites;
  const suitesRun = suitesFailed + suitesPassed + suitesQuarantined;
  const suitesTotal = aggregatedResults.numTotalTestSuites;
  const testsFailed = aggregatedResults.numFailedTests;
  const testsFlaky = aggregatedResults._unflakableNumFlakyTests;
  const testsPassed = aggregatedResults.numPassedTests;
  const testsPassedWithIndependentFailures =
    aggregatedResults._unflakableNumPassedTestsWithIndependentFailures;
  const testsPending = aggregatedResults.numPendingTests;
  const testsQuarantined = aggregatedResults._unflakableNumQuarantinedTests;
  const testsTodo = aggregatedResults.numTodoTests;
  const testsTotal = aggregatedResults.numTotalTests;
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
    suitesPassed > 0
      ? chalk.bold.green(
          `${suitesPassed} passed${
            suitesPassedWithIndependentFailures > 0
              ? ` (${suitesPassedWithIndependentFailures} with test-independent failures)`
              : ""
          }`
        ) + ", "
      : ""
  }${
    suitesRun !== suitesTotal ? `${suitesRun} of ${suitesTotal}` : suitesTotal
  } total`;

  const tests =
    chalk.bold("Tests:       ") +
    (testsFailed > 0 ? chalk.bold.red(`${testsFailed} failed`) + ", " : "") +
    (testsFlaky > 0
      ? chalk.bold.magentaBright(`${testsFlaky} flaky`) + ", "
      : "") +
    (testsQuarantined > 0
      ? chalk.bold.yellow(`${testsQuarantined} quarantined`) + ", "
      : "") +
    (testsPending > 0
      ? chalk.bold.yellow(`${testsPending} skipped`) + ", "
      : "") +
    (testsTodo > 0 ? chalk.bold.magenta(`${testsTodo} todo`) + ", " : "") +
    (testsPassed > 0
      ? chalk.bold.green(
          `${testsPassed} passed${
            testsPassedWithIndependentFailures > 0
              ? ` (${testsPassedWithIndependentFailures} with test-independent failures)`
              : ""
          }`
        ) + ", "
      : "") +
    `${testsTotal} total`;

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
