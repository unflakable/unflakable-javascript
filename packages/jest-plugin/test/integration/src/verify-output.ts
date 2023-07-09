// Copyright (c) 2023 Developer Innovations, LLC

// These are the chalk-formatted strings that include console color codes.
import escapeStringRegexp from "escape-string-regexp";
import { MOCK_RUN_ID, ResultCounts, TestCaseParams } from "./run-test-case";
import { TestAttemptResult } from "@unflakable/js-api";

const FAIL =
  "\u001b[0m\u001b[7m\u001b[1m\u001b[31m FAIL \u001b[39m\u001b[22m\u001b[27m\u001b[0m";
const PASS =
  "\u001b[0m\u001b[7m\u001b[1m\u001b[32m PASS \u001b[39m\u001b[22m\u001b[27m\u001b[0m";
const QUARANTINED =
  "\u001b[0m\u001b[7m\u001b[1m\u001b[33m QUARANTINED \u001b[39m\u001b[22m\u001b[27m\u001b[0m";
const formatTestFilename = (path: string, filename: string): string =>
  `\u001b[2m${path}\u001b[22m\u001b[1m${filename}\u001b[22m`;

const testResultRegexMatch = (
  result: TestAttemptResult | "skipped",
  testName: string,
  indent?: number
): RegExp =>
  new RegExp(
    `^${" ".repeat(indent ?? 4)}${escapeStringRegexp(
      result === "pass"
        ? // Green
          "\u001b[32m✓\u001b[39m"
        : result === "fail"
        ? // Red
          "\u001b[31m✕\u001b[39m"
        : result === "quarantined"
        ? // Yellow
          "\u001b[33m✕\u001b[39m"
        : result === "skipped"
        ? // Yellow
          "\u001b[33m○\u001b[39m"
        : ""
    )} \u001b\\[2m${result === "skipped" ? "skipped " : ""}${escapeStringRegexp(
      testName
    )}${
      result === "quarantined"
        ? escapeStringRegexp("\u001b[33m [quarantined]\u001b[39m")
        : ""
      // Test duration is only included if the test takes at least 1ms.
    }( \\([0-9]+ ms\\))?\u001b\\[22m$`,
    ""
  );

export const verifyOutput = (
  {
    expectPluginToBeEnabled,
    expectQuarantinedTestsToBeQuarantined,
    expectQuarantinedTestsToBeSkipped,
    expectResultsToBeUploaded,
    expectedFailureRetries,
    expectedFlakeTestNameSuffix,
    expectedSuiteId,
    failToFetchManifest,
    failToUploadResults,
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
  (testNamePattern === undefined ||
    "should pass".match(testNamePattern) !== null
    ? expect(stderrLines).toContain
    : expect(stderrLines).not.toContain)(
    `${PASS} ${formatTestFilename("src/", "pass.test.ts")}`
  );
  (testNamePattern === undefined ||
    "should pass".match(testNamePattern) !== null
    ? expect(stderrLines).toContainEqual
    : expect(stderrLines).not.toContainEqual)(
    // This test doesn't have a describe() block, so it's only indented 2 spaces.
    expect.stringMatching(testResultRegexMatch("pass", "should pass", 2))
  );

  (!skipFailures &&
    (testNamePattern === undefined ||
      "describe block should ([escape regex]?.*$ fail".match(
        testNamePattern
      ) !== null)
    ? expect(stderrLines).toContain
    : expect(stderrLines).not.toContain)(
    `${FAIL} ${formatTestFilename("src/", "fail.test.ts")}`
  );
  (!skipFailures &&
    (testNamePattern === undefined ||
      "describe block should ([escape regex]?.*$ fail".match(
        testNamePattern
      ) !== null)
    ? expect(stderrLines).toContainEqual
    : expect(stderrLines).not.toContainEqual)(
    expect.stringMatching(
      testResultRegexMatch("fail", "should ([escape regex]?.*$ fail")
    )
  );

  const flakyTest1Name = `should be flaky 1${expectedFlakeTestNameSuffix}`;
  const flakyTest1ShouldRun =
    !skipFlake &&
    (!quarantineFlake ||
      failToFetchManifest ||
      !expectQuarantinedTestsToBeSkipped) &&
    (testNamePattern === undefined ||
      flakyTest1Name.match(testNamePattern) !== null);
  (flakyTest1ShouldRun
    ? expect(stderrLines).toContain
    : expect(stderrLines).not.toContain)(
    `${
      quarantineFlake &&
      !failToFetchManifest &&
      expectQuarantinedTestsToBeQuarantined
        ? `${QUARANTINED} `
        : ""
    }${FAIL} ${formatTestFilename("src/", "flake.test.ts")}`
  );
  // This test should fail then pass (though we're not verifying the order here).
  (flakyTest1ShouldRun
    ? expect(stderrLines).toContainEqual
    : expect(stderrLines).not.toContainEqual)(
    expect.stringMatching(
      testResultRegexMatch(
        quarantineFlake && !failToFetchManifest ? "quarantined" : "fail",
        flakyTest1Name,
        2
      )
    )
  );
  (expectPluginToBeEnabled && expectedFailureRetries > 0 && flakyTest1ShouldRun
    ? expect(stderrLines).toContainEqual
    : expect(stderrLines).not.toContainEqual)(
    expect.stringMatching(testResultRegexMatch("pass", flakyTest1Name, 2))
  );

  const flakyTest2Name = `should be flaky 2${expectedFlakeTestNameSuffix}`;
  const flakyTest2ShouldRun =
    !skipFlake &&
    (!quarantineFlake ||
      failToFetchManifest ||
      !expectQuarantinedTestsToBeSkipped) &&
    (testNamePattern === undefined ||
      flakyTest2Name.match(testNamePattern) !== null);
  (flakyTest2ShouldRun
    ? expect(stderrLines).toContainEqual
    : expect(stderrLines).not.toContainEqual)(
    expect.stringMatching(
      testResultRegexMatch(
        quarantineFlake && !failToFetchManifest ? "quarantined" : "fail",
        flakyTest2Name,
        2
      )
    )
  );
  (expectPluginToBeEnabled && expectedFailureRetries > 0 && flakyTest2ShouldRun
    ? expect(stderrLines).toContainEqual
    : expect(stderrLines).not.toContainEqual)(
    expect.stringMatching(testResultRegexMatch("pass", flakyTest2Name, 2))
  );

  (!skipQuarantined &&
    (!expectQuarantinedTestsToBeSkipped || failToFetchManifest) &&
    (testNamePattern === undefined ||
      "describe block should be quarantined".match(testNamePattern) !== null)
    ? expect(stderrLines).toContain
    : expect(stderrLines).not.toContain)(
    `${
      expectPluginToBeEnabled &&
      !failToFetchManifest &&
      expectQuarantinedTestsToBeQuarantined &&
      !expectQuarantinedTestsToBeSkipped
        ? `${QUARANTINED} `
        : ""
    }${FAIL} ${formatTestFilename("src/", "quarantined.test.ts")}`
  );
  (!skipQuarantined &&
    (testNamePattern === undefined ||
      "describe block should be quarantined".match(testNamePattern) !== null) &&
    !expectQuarantinedTestsToBeSkipped
    ? expect(stderrLines).toContainEqual
    : expect(stderrLines).not.toContainEqual)(
    expect.stringMatching(
      testResultRegexMatch(
        expectPluginToBeEnabled &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        "should be quarantined"
      )
    )
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
  (((!expectPluginToBeEnabled ||
    failToFetchManifest ||
    !expectQuarantinedTestsToBeQuarantined) &&
    mixedQuarantinedTestShouldRun) ||
    mixedFailTestShouldRun
    ? expect(stderrLines).toContain
    : expect(stderrLines).not.toContain)(
    `${FAIL} ${formatTestFilename("src/", "mixed.test.ts")}`
  );
  (mixedQuarantinedTestShouldRun
    ? expect(stderrLines).toContainEqual
    : expect(stderrLines).not.toContainEqual)(
    expect.stringMatching(
      testResultRegexMatch(
        expectPluginToBeEnabled &&
          !failToFetchManifest &&
          expectQuarantinedTestsToBeQuarantined
          ? "quarantined"
          : "fail",
        "mixed: should be quarantined"
      )
    )
  );
  (mixedFailTestShouldRun
    ? expect(stderrLines).toContainEqual
    : expect(stderrLines).not.toContainEqual)(
    expect.stringMatching(testResultRegexMatch("fail", "mixed: should fail"))
  );

  expect(
    stderrLines.filter((line) =>
      testResultRegexMatch("pass", "mixed: should pass").test(line as string)
    )
  ).toHaveLength(mixedPassTestShouldRun ? 1 : 0);

  // The passed test gets skipped during the retries.
  if (mixedFailTestShouldRun || mixedQuarantinedTestShouldRun) {
    expect(
      stderrLines.filter((line) =>
        testResultRegexMatch("skipped", "mixed: should pass").test(
          line as string
        )
      )
    ).toHaveLength(
      testNamePattern !== undefined &&
        "mixed mixed: should pass".match(testNamePattern) === null &&
        expectPluginToBeEnabled
        ? expectedFailureRetries + 1
        : expectPluginToBeEnabled
        ? expectedFailureRetries
        : testNamePattern !== undefined &&
          "mixed mixed: should pass".match(testNamePattern) === null
        ? 1
        : 0
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
        ? `\u001b[1m\u001b[32m${expectedResults.passedSuites} passed\u001b[39m\u001b[22m, `
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
        ? `\u001b[1m\u001b[32m${expectedResults.passedTests} passed\u001b[39m\u001b[22m, `
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
        `${escapeStringRegexp("\u001b[1mTime:\u001b[22m        ")}[0-9.]+ s`
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
