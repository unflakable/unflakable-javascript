// Copyright (c) 2023 Developer Innovations, LLC

// These are the chalk-formatted strings that include console color codes.
import escapeStringRegexp from "escape-string-regexp";
import { MOCK_RUN_ID, ResultCounts, TestCaseParams } from "./run-test-case";
import { TestAttemptResult } from "@unflakable/js-api";

const FAIL_SYMBOL = process.platform === "win32" ? "×" : "✕";
const PASS_SYMBOL = process.platform === "win32" ? "√" : "✓";

const FAIL =
  "\u001b[0m\u001b[7m\u001b[1m\u001b[31m FAIL \u001b[39m\u001b[22m\u001b[27m\u001b[0m";
const PASS =
  "\u001b[0m\u001b[7m\u001b[1m\u001b[32m PASS \u001b[39m\u001b[22m\u001b[27m\u001b[0m";
const QUARANTINED =
  "\u001b[0m\u001b[7m\u001b[1m\u001b[33m QUARANTINED \u001b[39m\u001b[22m\u001b[27m\u001b[0m";
const SLOW_TEST_DETAIL_REGEX =
  "\u001b\\[0m\u001b\\[1m\u001b\\[41m[0-9.]+ ?.?s\u001b\\[49m\u001b\\[22m\u001b\\[0m";
const formatTestFilename = (dir: string, filename: string): string =>
  `\u001b[2m${dir}\u001b[22m\u001b[1m${filename}\u001b[22m`;

const specResultRegexMatch = (
  result: "fail" | "pass" | "quarantined",
  dir: string,
  filename: string
): RegExp =>
  // NB: Includes possible slow test duration:
  // https://github.com/jestjs/jest/blob/6d2632adae0f0fa1fe116d3b475fd9783d0de1b5/packages/jest-reporters/src/getResultHeader.ts#L43
  new RegExp(
    `^${escapeStringRegexp(
      `${result === "quarantined" ? QUARANTINED + " " : ""}${
        result === "pass" ? PASS : FAIL
      } ${formatTestFilename(dir, filename)}`
    )}(?: \\(${SLOW_TEST_DETAIL_REGEX}\\))?$`
  );

const testResultRegexMatch = (
  result: TestAttemptResult | "skipped",
  testName: string,
  indent?: number,
  isTestIndependent?: boolean
): RegExp =>
  new RegExp(
    `^${" ".repeat(indent ?? 4)}${escapeStringRegexp(
      result === "pass"
        ? // Green
          `\u001b[32m${PASS_SYMBOL}\u001b[39m`
        : result === "fail"
        ? // Red
          `\u001b[31m${FAIL_SYMBOL}\u001b[39m`
        : result === "quarantined"
        ? // Yellow
          `\u001b[33m${FAIL_SYMBOL}\u001b[39m`
        : result === "skipped"
        ? // Yellow
          "\u001b[33m○\u001b[39m"
        : ""
    )} \u001b\\[2m${result === "skipped" ? "skipped " : ""}${escapeStringRegexp(
      testName
    )}${
      isTestIndependent === true
        ? escapeStringRegexp("\u001b[31m [test independent]\u001b[39m")
        : ""
    }${
      result === "quarantined"
        ? escapeStringRegexp("\u001b[33m [quarantined]\u001b[39m")
        : ""
      // Test duration is only included if the test takes at least 1ms.
    }( \\([0-9]+ ms\\))?\u001b\\[22m$`,
    ""
  );

export const verifyOutput = (
  {
    expectFailuresToBeTestIndependent,
    expectFailuresFirstAttemptToBeTestIndependent,
    expectFlakeToBeTestIndependent,
    expectFlakeFirstAttemptToBeTestIndependent,
    expectPluginToBeEnabled,
    expectQuarantinedTestsToBeQuarantined,
    expectQuarantinedTestsToBeSkipped,
    expectQuarantinedTestsToBeTestIndependent,
    expectQuarantinedTestsFirstAttemptToBeTestIndependent,
    expectResultsToBeUploaded,
    expectedFailureRetries,
    expectedFlakeTestNameSuffix,
    expectedSuiteId,
    failToFetchManifest,
    failToUploadResults,
    flakeFailCount,
    quarantineFlake,
    skipFailures,
    skipFlake,
    skipQuarantined,
    testNamePattern,
  }: TestCaseParams,
  stderrLines: (Uint8Array | string)[],
  expectedResults: ResultCounts,
  apiServerPort: number
): void => {
  // Make sure expected output is present and chalk-formatted correctly.

  /* eslint-disable @typescript-eslint/unbound-method */

  // Test our VerboseReporter customization.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(specResultRegexMatch("pass", "src/", "pass.test.ts")),
    testNamePattern === undefined ||
      "should pass".match(testNamePattern) !== null
      ? 1
      : 0
  );

  expect(stderrLines).toContainEqualTimes(
    // This test doesn't have a describe() block, so it's only indented 2 spaces.
    expect.stringMatching(testResultRegexMatch("pass", "should pass", 2)),
    testNamePattern === undefined ||
      "should pass".match(testNamePattern) !== null
      ? 1
      : 0
  );

  const numFailAttempts =
    !skipFailures &&
    (testNamePattern === undefined ||
      "describe block should ([escape regex]?.*$ fail".match(
        testNamePattern
      ) !== null)
      ? expectPluginToBeEnabled
        ? 1 + expectedFailureRetries
        : 1
      : 0;
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(specResultRegexMatch("fail", "src/", "fail.test.ts")),
    numFailAttempts
  );

  // Test-independent failure.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch(
        "fail",
        "should ([escape regex]?.*$ fail",
        4,
        true // isTestIndependent
      )
    ),
    expectPluginToBeEnabled &&
      !skipFailures &&
      (testNamePattern === undefined ||
        "describe block should ([escape regex]?.*$ fail".match(
          testNamePattern
        ) !== null)
      ? expectFailuresToBeTestIndependent
        ? 1 + expectedFailureRetries
        : expectFailuresFirstAttemptToBeTestIndependent
        ? 1
        : 0
      : 0
  );
  // Non-test-independent failures.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch("fail", "should ([escape regex]?.*$ fail")
    ),
    !skipFailures &&
      (testNamePattern === undefined ||
        "describe block should ([escape regex]?.*$ fail".match(
          testNamePattern
        ) !== null)
      ? expectPluginToBeEnabled
        ? expectFailuresToBeTestIndependent
          ? 0
          : expectFailuresFirstAttemptToBeTestIndependent
          ? expectedFailureRetries
          : 1 + expectedFailureRetries
        : 1
      : 0
  );

  const flakyTest1Name = `should be flaky 1${expectedFlakeTestNameSuffix}`;
  const flakyTest1ShouldRun =
    !skipFlake &&
    (!quarantineFlake ||
      failToFetchManifest ||
      !expectQuarantinedTestsToBeSkipped) &&
    (testNamePattern === undefined ||
      flakyTest1Name.match(testNamePattern) !== null);

  // This test should fail then pass (though we're not verifying the order here).
  // Test-independent failure.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch(
        quarantineFlake &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        flakyTest1Name,
        2,
        true
      )
    ),
    expectPluginToBeEnabled && flakyTest1ShouldRun
      ? expectFlakeToBeTestIndependent
        ? flakeFailCount
        : expectFlakeFirstAttemptToBeTestIndependent
        ? 1
        : 0
      : 0
  );
  // Non-test-independent failures.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch(
        quarantineFlake &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        flakyTest1Name,
        2
      )
    ),
    flakyTest1ShouldRun
      ? expectPluginToBeEnabled
        ? expectFlakeToBeTestIndependent
          ? 0 // These all ran above
          : expectFlakeFirstAttemptToBeTestIndependent
          ? Math.max(0, flakeFailCount - 1)
          : flakeFailCount
        : 1 // Plugin disabled
      : 0
  );

  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(testResultRegexMatch("pass", flakyTest1Name, 2)),
    expectPluginToBeEnabled && expectedFailureRetries > 0 && flakyTest1ShouldRun
      ? 1
      : 0
  );

  const flakyTest2Name = `should be flaky 2${expectedFlakeTestNameSuffix}`;
  const flakyTest2ShouldRun =
    !skipFlake &&
    (!quarantineFlake ||
      failToFetchManifest ||
      !expectQuarantinedTestsToBeSkipped) &&
    (testNamePattern === undefined ||
      flakyTest2Name.match(testNamePattern) !== null);
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch(
        quarantineFlake &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        flakyTest2Name,
        2,
        expectFlakeToBeTestIndependent
      )
    ),
    flakyTest2ShouldRun ? 1 : 0
  );

  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(testResultRegexMatch("pass", flakyTest2Name, 2)),
    expectPluginToBeEnabled && expectedFailureRetries > 0 && flakyTest2ShouldRun
      ? 1
      : 0
  );

  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      specResultRegexMatch(
        quarantineFlake &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        "src/",
        "flake.test.ts"
      )
    ),
    flakyTest1ShouldRun || flakyTest2ShouldRun ? flakeFailCount : 0
  );
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      specResultRegexMatch("pass", "src/", "flake.test.ts")
    ),
    expectPluginToBeEnabled &&
      (flakyTest1ShouldRun || flakyTest2ShouldRun) &&
      expectedFailureRetries > 0
      ? 1
      : 0
  );

  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      specResultRegexMatch("fail", "src/", "invalid.test.ts")
    ),
    !skipFailures ? 1 : 0
  );

  const numQuarantinedAttempts =
    !skipQuarantined &&
    (!expectQuarantinedTestsToBeSkipped || failToFetchManifest) &&
    (testNamePattern === undefined ||
      "describe block should be quarantined".match(testNamePattern) !== null)
      ? expectPluginToBeEnabled
        ? 1 + expectedFailureRetries
        : 1
      : 0;
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      specResultRegexMatch(
        expectPluginToBeEnabled &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined &&
          !expectQuarantinedTestsToBeSkipped
          ? "quarantined"
          : "fail",
        "src/",
        "quarantined.test.ts"
      )
    ),
    numQuarantinedAttempts
  );

  // Test-independent failure.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch(
        expectPluginToBeEnabled &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        "should be quarantined",
        4,
        true
      )
    ),
    expectPluginToBeEnabled &&
      !skipQuarantined &&
      (testNamePattern === undefined ||
        "describe block should be quarantined".match(testNamePattern) !==
          null) &&
      !expectQuarantinedTestsToBeSkipped
      ? expectQuarantinedTestsToBeTestIndependent
        ? 1 + expectedFailureRetries
        : expectQuarantinedTestsFirstAttemptToBeTestIndependent
        ? 1
        : 0
      : 0
  );
  // Non-test-independent failures.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch(
        expectPluginToBeEnabled &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        "should be quarantined"
      )
    ),
    !skipQuarantined &&
      (testNamePattern === undefined ||
        "describe block should be quarantined".match(testNamePattern) !==
          null) &&
      !expectQuarantinedTestsToBeSkipped
      ? expectPluginToBeEnabled
        ? expectQuarantinedTestsToBeTestIndependent
          ? 0
          : expectQuarantinedTestsFirstAttemptToBeTestIndependent
          ? expectedFailureRetries
          : 1 + expectedFailureRetries
        : 1
      : 0
  );

  const mixedFailTestShouldRun =
    !skipFailures &&
    (testNamePattern === undefined ||
      "mixed mixed: should fail".match(testNamePattern) !== null);
  const mixedQuarantinedTestShouldRun =
    !expectQuarantinedTestsToBeSkipped &&
    !skipQuarantined &&
    (testNamePattern === undefined ||
      "mixed mixed: should be quarantined".match(testNamePattern) !== null);
  const mixedPassTestShouldRun =
    testNamePattern === undefined ||
    "mixed mixed: should pass".match(testNamePattern) !== null;

  // Mixed file containing both a failed test and a quarantined one.
  const numMixedFailingAttempts =
    ((!expectPluginToBeEnabled ||
      failToFetchManifest ||
      !expectQuarantinedTestsToBeQuarantined) &&
      mixedQuarantinedTestShouldRun) ||
    mixedFailTestShouldRun
      ? expectPluginToBeEnabled
        ? 1 + expectedFailureRetries
        : 1
      : 0;
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      specResultRegexMatch("fail", "src/", "mixed.test.ts")
    ),
    numMixedFailingAttempts
  );
  const numMixedQuarantinedAttempts =
    expectPluginToBeEnabled &&
    !failToFetchManifest &&
    !mixedFailTestShouldRun &&
    mixedQuarantinedTestShouldRun &&
    expectQuarantinedTestsToBeQuarantined
      ? 1 + expectedFailureRetries
      : 0;
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      specResultRegexMatch("quarantined", "src/", "mixed.test.ts")
    ),
    numMixedQuarantinedAttempts
  );
  const hasMixedPassingAttempt = skipFailures && skipQuarantined;
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      specResultRegexMatch("pass", "src/", "mixed.test.ts")
    ),
    hasMixedPassingAttempt ? 1 : 0
  );

  // Test-independent failure.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch(
        expectPluginToBeEnabled &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        "mixed: should be quarantined",
        4,
        true // isTestIndependent
      )
    ),
    expectPluginToBeEnabled && mixedQuarantinedTestShouldRun
      ? expectQuarantinedTestsToBeTestIndependent
        ? 1 + expectedFailureRetries
        : expectQuarantinedTestsFirstAttemptToBeTestIndependent
        ? 1
        : 0
      : 0
  );
  // Non-test-independent failures.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch(
        expectPluginToBeEnabled &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        "mixed: should be quarantined"
      )
    ),
    mixedQuarantinedTestShouldRun
      ? expectPluginToBeEnabled
        ? expectQuarantinedTestsToBeTestIndependent
          ? 0
          : expectQuarantinedTestsFirstAttemptToBeTestIndependent
          ? expectedFailureRetries
          : 1 + expectedFailureRetries
        : 1
      : 0
  );

  // Test-independent failure.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch(
        "fail",
        "mixed: should fail",
        4,
        true // isTestIndependent
      )
    ),
    expectPluginToBeEnabled && mixedFailTestShouldRun
      ? expectFailuresToBeTestIndependent
        ? 1 + expectedFailureRetries
        : expectFailuresFirstAttemptToBeTestIndependent
        ? 1
        : 0
      : 0
  );
  // Non-test-independent failures.
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(testResultRegexMatch("fail", "mixed: should fail")),
    mixedFailTestShouldRun
      ? expectPluginToBeEnabled
        ? expectFailuresToBeTestIndependent
          ? 0
          : expectFailuresFirstAttemptToBeTestIndependent
          ? expectedFailureRetries
          : 1 + expectedFailureRetries
        : 1
      : 0
  );

  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(testResultRegexMatch("pass", "mixed: should pass")),
    mixedPassTestShouldRun ? 1 : 0
  );
  expect(stderrLines).toContainEqualTimes(
    expect.stringMatching(
      testResultRegexMatch("skipped", "mixed: should pass")
    ),
    mixedFailTestShouldRun || mixedQuarantinedTestShouldRun
      ? testNamePattern !== undefined &&
        "mixed mixed: should pass".match(testNamePattern) === null &&
        expectPluginToBeEnabled
        ? expectedFailureRetries + 1
        : expectPluginToBeEnabled
        ? expectedFailureRetries
        : testNamePattern !== undefined &&
          "mixed mixed: should pass".match(testNamePattern) === null
        ? 1
        : 0
      : 0
  );

  for (let attempt = 1; attempt < expectedFailureRetries; attempt++) {
    const numTestsToRetry =
      (!skipFailures && numFailAttempts > attempt ? 1 : 0) +
      (flakeFailCount + 1 > attempt
        ? (flakyTest1ShouldRun ? 1 : 0) + (flakyTest2ShouldRun ? 1 : 0)
        : 0) +
      (numQuarantinedAttempts > attempt ? 1 : 0) +
      (numMixedFailingAttempts + numMixedQuarantinedAttempts > attempt
        ? (mixedFailTestShouldRun ? 1 : 0) +
          (mixedQuarantinedTestShouldRun ? 1 : 0)
        : 0);
    const numTestFilesToRetry =
      (!skipFailures && numFailAttempts > attempt ? 1 : 0) +
      ((flakyTest1ShouldRun || flakyTest2ShouldRun) &&
      flakeFailCount + 1 > attempt
        ? 1
        : 0) +
      (numQuarantinedAttempts > attempt ? 1 : 0) +
      ((mixedFailTestShouldRun || mixedQuarantinedTestShouldRun) &&
      numMixedFailingAttempts + numMixedQuarantinedAttempts > attempt
        ? 1
        : 0);
    expect(numTestsToRetry).toBeGreaterThanOrEqual(numTestFilesToRetry);
    expect(stderrLines).toContainEqualTimes(
      `\u001b[33m\u001b[1mRetrying ${numTestsToRetry} failed test${
        numTestsToRetry === 1 ? "" : "s"
      } from ${numTestFilesToRetry} file${
        numTestFilesToRetry === 1 ? "" : "s"
      } -- ${expectedFailureRetries - attempt} ${
        expectedFailureRetries - attempt === 1 ? "retry" : "retries"
      } remaining\u001b[22m\u001b[39m`,
      expectPluginToBeEnabled && numTestsToRetry > 0 ? 1 : 0
    );
  }

  // Test our SummaryReporter customization.
  expect(stderrLines).toContain(
    `\u001b[1mTest Suites: \u001b[22m${
      expectedResults.failedSuites !== 0
        ? `\u001b[1m\u001b[31m${expectedResults.failedSuites} failed\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.quarantinedSuites !== 0
        ? `\u001b[1m\u001b[33m${expectedResults.quarantinedSuites} quarantined\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.skippedSuites !== 0
        ? `\u001b[1m\u001b[33m${expectedResults.skippedSuites} skipped\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.passedSuites !== 0
        ? `\u001b[1m\u001b[32m${expectedResults.passedSuites} passed${
            expectedResults.passedSuitesWithIndependentFailures > 0
              ? ` (${expectedResults.passedSuitesWithIndependentFailures} with test-independent failures)`
              : ""
          }\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.skippedSuites !== 0
        ? `${
            expectedResults.failedSuites +
            expectedResults.quarantinedSuites +
            expectedResults.passedSuites
          } of ${
            expectedResults.failedSuites +
            expectedResults.quarantinedSuites +
            expectedResults.passedSuites +
            expectedResults.skippedSuites
          }`
        : expectedResults.failedSuites +
          expectedResults.quarantinedSuites +
          expectedResults.passedSuites
    } total`
  );

  expect(stderrLines).toContain(
    `\u001b[1mTests:       \u001b[22m${
      expectedResults.failedTests !== 0
        ? `\u001b[1m\u001b[31m${expectedResults.failedTests} failed\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.flakyTests !== 0
        ? `\u001b[1m\u001b[95m${expectedResults.flakyTests} flaky\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.quarantinedTests !== 0
        ? `\u001b[1m\u001b[33m${expectedResults.quarantinedTests} quarantined\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.skippedTests !== 0
        ? `\u001b[1m\u001b[33m${expectedResults.skippedTests} skipped\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.passedTests !== 0
        ? `\u001b[1m\u001b[32m${expectedResults.passedTests} passed${
            expectedResults.passedTestsWithIndependentFailures > 0
              ? ` (${expectedResults.passedTestsWithIndependentFailures} with test-independent failures)`
              : ""
          }\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.failedTests +
      expectedResults.flakyTests +
      expectedResults.quarantinedTests +
      expectedResults.passedTests +
      expectedResults.skippedTests
    } total`
  );

  expect(stderrLines).toContain(
    `\u001b[1mSnapshots:   \u001b[22m${
      expectedResults.failedSnapshots > 0
        ? `\u001b[1m\u001b[31m${expectedResults.failedSnapshots} failed\u001b[39m\u001b[22m, `
        : ""
    }${
      expectedResults.passedSnapshots > 0
        ? `\u001b[1m\u001b[32m${expectedResults.passedSnapshots} passed\u001b[39m\u001b[22m, `
        : ""
    }${expectedResults.totalSnapshots} total`
  );
  // None of the snapshots should be obsolete.
  expect(stderrLines).not.toContainEqual(
    expect.stringMatching(new RegExp("[0-9]+ snapshot(:?s)? obsolete"))
  );

  // The duration here is based on the mocked time, so it should be deterministic.
  expect(stderrLines).toContainEqual(
    expect.stringMatching(
      new RegExp(
        `${escapeStringRegexp(
          "\u001b[1mTime:\u001b[22m        "
        )}(?:\u001b\\[1m\u001b\\[33m[0-9.]+ s\u001b\\[39m\u001b\\[22m|[0-9.]+ s)(?:, estimated [0-9.]+ s)?`
      )
    )
  );

  expect(stderrLines).toContain(
    `\u001b[2mRan all test suites\u001b[22m\u001b[2m${
      testNamePattern !== undefined
        ? ` with tests matching \u001b[22m"${testNamePattern}"\u001b[2m`
        : ""
    }.\u001b[22m`
  );

  (expectPluginToBeEnabled && expectResultsToBeUploaded && !failToUploadResults
    ? expect(stderrLines).toContain
    : expect(stderrLines).not.toContain)(
    `Unflakable report: http://localhost:${apiServerPort}/test-suites/${expectedSuiteId}/runs/${MOCK_RUN_ID}`
  );
};
