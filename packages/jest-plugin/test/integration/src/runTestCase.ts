// Copyright (c) 2022 Developer Innovations, LLC

import chalk from "chalk";
import temp from "temp";
import {
  FetchMockSandbox,
  MockCall,
  MockRequest,
  MockResponse,
  MockMatcher,
} from "fetch-mock";
import { run } from "jest";
import escapeStringRegexp from "escape-string-regexp";
import {
  CreateTestSuiteRunRequest,
  TEST_NAME_ENTRY_MAX_LENGTH,
  TestAttemptResult,
  TestRunAttemptRecord,
  TestRunRecord,
  TestSuiteManifest,
  TestSuiteRunSummary,
} from "@unflakable/js-api";
import simpleGit, { SimpleGit } from "simple-git";
import type { Response as GitResponse, TaskOptions } from "simple-git";
import deepEqual from "deep-equal";
import * as cosmiconfig from "cosmiconfig";
import { CosmiconfigResult } from "cosmiconfig/dist/types";
import { UnflakableConfig } from "../../../src/types";

const userAgentRegex = new RegExp(
  "unflakable-js-api/(?:[-0-9.]|alpha|beta)+ unflakable-jest-plugin/(?:[-0-9.]|alpha|beta)+ \\(Jest [0-9]+\\.[0-9]+\\.[0-9]+; Node v[0-9]+\\.[0-9]+\\.[0-9]\\)"
);

export type SimpleGitMockRef = {
  sha: string;
  refName: string;
};
export type SimpleGitMockParams =
  | {
      abbreviatedRefs?: undefined;
      commit?: undefined;
      isRepo: false;
      refs?: undefined;
    }
  | {
      // Maps ref name (e.g., HEAD or refs/remotes/pull/1/merge) to the `git --abbrev-ref <refname>`
      // response (e.g., branch-name, pull/1/merge, or in the case of a detached HEAD, HEAD).
      abbreviatedRefs: { [key in string]: string };
      commit: string;
      isRepo: true;
      refs: SimpleGitMockRef[];
    };

export type TestCaseParams = {
  config: Partial<UnflakableConfig> | null;
  envVars: { [key in string]: string | undefined };
  expectedApiKey: string;
  expectedBranch: string | undefined;
  expectedCommit: string | undefined;
  expectedFailureRetries: number;
  expectedFlakeTestNameSuffix: string;
  expectedSuiteId: string;
  expectPluginToBeEnabled: boolean;
  expectResultsToBeUploaded: boolean;
  expectQuarantinedTestsToBeQuarantined: boolean;
  expectQuarantinedTestsToBeSkipped: boolean;
  expectSnapshots: boolean;
  failToFetchManifest: boolean;
  failToUploadResults: boolean;
  git: SimpleGitMockParams;
  quarantineFlake: boolean;
  skipFailures: boolean;
  skipFlake: boolean;
  skipQuarantined: boolean;
  testNamePattern: string | undefined;
};

const originalStderrWrite = process.stderr.write.bind(process.stderr);

const mockSimpleGit = (params: SimpleGitMockParams): void => {
  (simpleGit as jest.Mock).mockImplementationOnce(
    () =>
      ({
        checkIsRepo: jest.fn(
          () => Promise.resolve(params.isRepo) as GitResponse<boolean>
        ),
        revparse: jest.fn((options: string | TaskOptions) => {
          if (!params.isRepo) {
            throw new Error("not a git repository");
          } else if (
            Array.isArray(options) &&
            options.length === 2 &&
            options[0] === "--abbrev-ref"
          ) {
            return Promise.resolve(
              params.abbreviatedRefs[options[1]] ?? "HEAD"
            ) as GitResponse<string>;
          } else if (options === "HEAD") {
            return Promise.resolve(params.commit) as GitResponse<string>;
          } else {
            throw new Error(`unexpected options ${options.toString()}`);
          }
        }),
        raw: jest.fn((options: string | TaskOptions) => {
          if (!params.isRepo) {
            throw new Error("not a git repository");
          } else if (deepEqual(options, ["show-ref"])) {
            return Promise.resolve(
              (params.refs ?? [])
                .map((mockRef) => `${mockRef.sha} ${mockRef.refName}`)
                .join("\n") + "\n"
            ) as GitResponse<string>;
          } else {
            throw new Error(`unexpected options ${options.toString()}`);
          }
        }),
      } as unknown as SimpleGit)
  );
};

// These are the chalk-formatted strings that include console color codes.
const FAIL =
  "\u001b[0m\u001b[7m\u001b[1m\u001b[31m FAIL \u001b[39m\u001b[22m\u001b[27m\u001b[0m";
const PASS =
  "\u001b[0m\u001b[7m\u001b[1m\u001b[32m PASS \u001b[39m\u001b[22m\u001b[27m\u001b[0m";
const QUARANTINED =
  "\u001b[0m\u001b[7m\u001b[1m\u001b[33m QUARANTINED \u001b[39m\u001b[22m\u001b[27m\u001b[0m";
const formatTestFilename = (path: string, filename: string) =>
  `\u001b[2m${path}\u001b[22m\u001b[1m${filename}\u001b[22m`;

const testResultRegexMatch = (
  result: TestAttemptResult | "skipped",
  testName: string,
  indent?: number
) =>
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

export type ResultCounts = {
  passedSuites: number;
  passedTests: number;
  failedSuites: number;
  failedTests: number;
  flakyTests: number;
  quarantinedSuites: number;
  quarantinedTests: number;
  skippedSuites: number;
  skippedTests: number;
  passedSnapshots: number;
  failedSnapshots: number;
  totalSnapshots: number;
};

const countResults = ({
  expectPluginToBeEnabled,
  expectQuarantinedTestsToBeQuarantined,
  expectQuarantinedTestsToBeSkipped,
  expectedFailureRetries,
  expectedFlakeTestNameSuffix,
  expectSnapshots,
  failToFetchManifest,
  quarantineFlake,
  skipFailures,
  skipFlake,
  skipQuarantined,
  testNamePattern,
}: TestCaseParams): ResultCounts => {
  const flakyTest1ShouldRun =
    !skipFlake &&
    (!expectPluginToBeEnabled ||
      !quarantineFlake ||
      !expectQuarantinedTestsToBeSkipped ||
      failToFetchManifest) &&
    (testNamePattern === undefined ||
      `should be flaky 1${expectedFlakeTestNameSuffix}`.match(
        testNamePattern
      ) !== null);
  const flakyTest2ShouldRun =
    !skipFlake &&
    (!expectPluginToBeEnabled ||
      !quarantineFlake ||
      !expectQuarantinedTestsToBeSkipped ||
      failToFetchManifest) &&
    (testNamePattern === undefined ||
      `should be flaky 2${expectedFlakeTestNameSuffix}`.match(
        testNamePattern
      ) !== null);

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

  const quarantinedTestShouldRun =
    !expectQuarantinedTestsToBeSkipped &&
    !skipQuarantined &&
    (testNamePattern === undefined ||
      "describe block should be quarantined".match(testNamePattern) !== null);

  return [
    // fail.test.ts
    {
      failedSuites:
        (testNamePattern === undefined ||
          "describe block should ([escape regex]?.*$ fail".match(
            testNamePattern
          ) !== null) &&
        !skipFailures
          ? 1
          : 0,
      failedTests:
        (testNamePattern === undefined ||
          "describe block should ([escape regex]?.*$ fail".match(
            testNamePattern
          ) !== null) &&
        !skipFailures
          ? 1
          : 0,
      flakyTests: 0,
      passedSuites: 0,
      passedTests: 0,
      quarantinedSuites: 0,
      quarantinedTests: 0,
      skippedSuites:
        (testNamePattern !== undefined &&
          "describe block should ([escape regex]?.*$ fail".match(
            testNamePattern
          ) === null) ||
        skipFailures
          ? 1
          : 0,
      skippedTests:
        (testNamePattern !== undefined &&
          "describe block should ([escape regex]?.*$ fail".match(
            testNamePattern
          ) === null) ||
        skipFailures
          ? 1
          : 0,
      passedSnapshots: 0,
      failedSnapshots: expectSnapshots ? 1 : 0,
      totalSnapshots: expectSnapshots ? 1 : 0,
    },
    // flake.test.ts
    {
      failedSuites:
        (!expectPluginToBeEnabled || !quarantineFlake) &&
        (flakyTest1ShouldRun || flakyTest2ShouldRun)
          ? 1
          : 0,
      failedTests:
        !expectPluginToBeEnabled || expectedFailureRetries === 0
          ? (flakyTest1ShouldRun ? 1 : 0) + (flakyTest2ShouldRun ? 1 : 0)
          : 0,
      flakyTests:
        expectPluginToBeEnabled &&
        expectedFailureRetries > 0 &&
        !quarantineFlake
          ? (flakyTest1ShouldRun ? 1 : 0) + (flakyTest2ShouldRun ? 1 : 0)
          : 0,
      passedSuites: 0,
      passedTests: 0,
      quarantinedSuites:
        expectPluginToBeEnabled &&
        quarantineFlake &&
        expectQuarantinedTestsToBeQuarantined &&
        (flakyTest1ShouldRun || flakyTest2ShouldRun)
          ? 1
          : 0,
      quarantinedTests:
        expectPluginToBeEnabled &&
        quarantineFlake &&
        expectQuarantinedTestsToBeQuarantined
          ? (flakyTest1ShouldRun ? 1 : 0) + (flakyTest2ShouldRun ? 1 : 0)
          : 0,
      skippedSuites: !flakyTest1ShouldRun && !flakyTest2ShouldRun ? 1 : 0,
      skippedTests:
        (!flakyTest1ShouldRun ? 1 : 0) + (!flakyTest2ShouldRun ? 1 : 0),
      passedSnapshots: 0,
      failedSnapshots: expectSnapshots ? 2 : 0,
      totalSnapshots: expectSnapshots ? 2 : 0,
    },
    // invalid.test.ts
    {
      // If skipFailures is enabled, then we exclude the whole file using a path regex.
      failedSuites: skipFailures ? 0 : 1,
      failedTests: 0,
      flakyTests: 0,
      passedSuites: 0,
      passedTests: 0,
      quarantinedSuites: 0,
      quarantinedTests: 0,
      skippedSuites: 0,
      skippedTests: 0,
      passedSnapshots: 0,
      failedSnapshots: 0,
      totalSnapshots: 0,
    },
    // mixed.test.ts
    {
      failedSuites:
        ((!expectPluginToBeEnabled ||
          !expectQuarantinedTestsToBeQuarantined ||
          failToFetchManifest) &&
          mixedQuarantinedTestShouldRun) ||
        mixedFailTestShouldRun
          ? 1
          : 0,
      failedTests:
        ((!expectPluginToBeEnabled ||
          !expectQuarantinedTestsToBeQuarantined ||
          failToFetchManifest) &&
        mixedQuarantinedTestShouldRun
          ? 1
          : 0) + (mixedFailTestShouldRun ? 1 : 0),
      flakyTests: 0,
      passedSuites:
        !mixedFailTestShouldRun &&
        !mixedQuarantinedTestShouldRun &&
        mixedPassTestShouldRun
          ? 1
          : 0,
      passedTests: mixedPassTestShouldRun ? 1 : 0,
      quarantinedSuites:
        expectPluginToBeEnabled &&
        expectQuarantinedTestsToBeQuarantined &&
        !failToFetchManifest &&
        !mixedFailTestShouldRun &&
        mixedQuarantinedTestShouldRun
          ? 1
          : 0,
      quarantinedTests:
        expectPluginToBeEnabled &&
        expectQuarantinedTestsToBeQuarantined &&
        !failToFetchManifest &&
        mixedQuarantinedTestShouldRun
          ? 1
          : 0,
      skippedSuites:
        !mixedQuarantinedTestShouldRun &&
        !mixedFailTestShouldRun &&
        !mixedPassTestShouldRun
          ? 1
          : 0,
      skippedTests:
        (!mixedQuarantinedTestShouldRun ? 1 : 0) +
        (!mixedFailTestShouldRun ? 1 : 0) +
        (!mixedPassTestShouldRun ? 1 : 0),
      passedSnapshots:
        !expectSnapshots && mixedQuarantinedTestShouldRun ? 1 : 0,
      failedSnapshots: expectSnapshots && mixedQuarantinedTestShouldRun ? 1 : 0,
      totalSnapshots: mixedQuarantinedTestShouldRun ? 1 : 0,
    },
    // pass.test.ts
    {
      failedSuites: 0,
      failedTests: 0,
      flakyTests: 0,
      passedSuites:
        testNamePattern === undefined ||
        "should pass".match(testNamePattern) !== null
          ? 1
          : 0,
      passedTests:
        testNamePattern === undefined ||
        "should pass".match(testNamePattern) !== null
          ? 1
          : 0,
      quarantinedSuites: 0,
      quarantinedTests: 0,
      skippedSuites:
        testNamePattern !== undefined &&
        "should pass".match(testNamePattern) === null
          ? 1
          : 0,
      skippedTests:
        testNamePattern !== undefined &&
        "should pass".match(testNamePattern) === null
          ? 1
          : 0,
      passedSnapshots: expectSnapshots ? 1 : 0,
      failedSnapshots: 0,
      totalSnapshots: expectSnapshots ? 1 : 0,
    },
    // quarantined.test.ts
    {
      failedSuites:
        (!expectPluginToBeEnabled ||
          !expectQuarantinedTestsToBeQuarantined ||
          failToFetchManifest) &&
        quarantinedTestShouldRun
          ? 1
          : 0,
      failedTests:
        (!expectPluginToBeEnabled ||
          !expectQuarantinedTestsToBeQuarantined ||
          failToFetchManifest) &&
        quarantinedTestShouldRun
          ? 1
          : 0,
      flakyTests: 0,
      passedSuites: 0,
      passedTests: 0,
      quarantinedSuites:
        expectPluginToBeEnabled &&
        expectQuarantinedTestsToBeQuarantined &&
        !failToFetchManifest &&
        quarantinedTestShouldRun
          ? 1
          : 0,
      quarantinedTests:
        expectPluginToBeEnabled &&
        expectQuarantinedTestsToBeQuarantined &&
        !failToFetchManifest &&
        quarantinedTestShouldRun
          ? 1
          : 0,
      skippedSuites: !quarantinedTestShouldRun ? 1 : 0,
      skippedTests: !quarantinedTestShouldRun ? 1 : 0,
      passedSnapshots: 0,
      failedSnapshots: 0,
      totalSnapshots: 0,
    },
  ].reduce((a: ResultCounts, b: ResultCounts) => ({
    failedSuites: a.failedSuites + b.failedSuites,
    failedTests: a.failedTests + b.failedTests,
    flakyTests: a.flakyTests + b.flakyTests,
    passedSuites: a.passedSuites + b.passedSuites,
    passedTests: a.passedTests + b.passedTests,
    quarantinedSuites: a.quarantinedSuites + b.quarantinedSuites,
    quarantinedTests: a.quarantinedTests + b.quarantinedTests,
    skippedSuites: a.skippedSuites + b.skippedSuites,
    skippedTests: a.skippedTests + b.skippedTests,
    passedSnapshots: a.passedSnapshots + b.passedSnapshots,
    failedSnapshots: a.failedSnapshots + b.failedSnapshots,
    totalSnapshots: a.totalSnapshots + b.totalSnapshots,
  }));
};

const uploadResultsMatcher =
  (
    {
      expectedBranch,
      expectedCommit,
      expectedFailureRetries,
      expectedFlakeTestNameSuffix,
      expectQuarantinedTestsToBeQuarantined,
      expectQuarantinedTestsToBeSkipped,
      failToFetchManifest,
      quarantineFlake,
      skipFailures,
      skipFlake,
      skipQuarantined,
      testNamePattern,
    }: TestCaseParams,
    results: ResultCounts
  ): MockMatcher =>
  (_url, { body, headers }) => {
    const parsedBody = JSON.parse(body as string) as CreateTestSuiteRunRequest;

    expect((headers as { [key in string]: string })["User-Agent"]).toMatch(
      userAgentRegex
    );

    const testNamePatternRegex =
      testNamePattern !== undefined ? new RegExp(testNamePattern) : undefined;

    parsedBody.test_runs.sort((a, b) =>
      a.filename < b.filename
        ? -1
        : a.filename > b.filename
        ? 1
        : a.name < b.name
        ? -1
        : a.name > b.name
        ? 1
        : a < b
        ? -1
        : a > b
        ? 1
        : 0
    );

    expect(parsedBody).toEqual({
      ...(expectedBranch !== undefined
        ? {
            branch: expectedBranch,
          }
        : {}),
      ...(expectedCommit !== undefined
        ? {
            commit: expectedCommit,
          }
        : {}),
      start_time: "2022-01-23T04:05:06.789Z",
      end_time: expect.stringMatching(/2022-01-23T04:05:..\..89Z/) as string,
      test_runs: expect.arrayContaining<TestRunRecord>(
        [
          ...(skipFailures
            ? ([] as TestRunRecord[])
            : ([
                {
                  filename: "../integration-input/src/fail.test.ts",
                  name: ["describe block", "should ([escape regex]?.*$ fail"],
                  attempts: Array<TestRunAttemptRecord>(
                    expectedFailureRetries + 1
                  ).fill({
                    duration_ms: expect.any(Number) as number,
                    result: "fail",
                  }),
                },
              ] as TestRunRecord[])),
          ...(skipFlake ||
          (expectQuarantinedTestsToBeSkipped &&
            quarantineFlake &&
            !failToFetchManifest) ||
          (testNamePattern !== undefined &&
            `should be flaky 1${expectedFlakeTestNameSuffix}`.match(
              testNamePattern
            ) === null)
            ? []
            : [
                {
                  filename: "../integration-input/src/flake.test.ts",
                  name: [
                    `should be flaky 1${expectedFlakeTestNameSuffix}`.substring(
                      0,
                      TEST_NAME_ENTRY_MAX_LENGTH
                    ),
                  ],
                  attempts: [
                    {
                      duration_ms: expect.any(Number) as number,
                      result:
                        quarantineFlake &&
                        !failToFetchManifest &&
                        expectQuarantinedTestsToBeQuarantined
                          ? "quarantined"
                          : "fail",
                    },
                    ...(expectedFailureRetries > 0
                      ? [
                          {
                            duration_ms: expect.any(Number) as number,
                            result: "pass",
                          },
                        ]
                      : []),
                  ],
                } as TestRunRecord,
              ]),
          ...(skipFlake ||
          (expectQuarantinedTestsToBeSkipped &&
            quarantineFlake &&
            !failToFetchManifest) ||
          (testNamePattern !== undefined &&
            `should be flaky 2${expectedFlakeTestNameSuffix}`.match(
              testNamePattern
            ) === null)
            ? []
            : [
                {
                  filename: "../integration-input/src/flake.test.ts",
                  name: [
                    `should be flaky 2${expectedFlakeTestNameSuffix}`.substring(
                      0,
                      TEST_NAME_ENTRY_MAX_LENGTH
                    ),
                  ],
                  attempts: [
                    {
                      duration_ms: expect.any(Number) as number,
                      result:
                        quarantineFlake &&
                        !failToFetchManifest &&
                        expectQuarantinedTestsToBeQuarantined
                          ? "quarantined"
                          : "fail",
                    },
                    ...(expectedFailureRetries > 0
                      ? [
                          {
                            duration_ms: expect.any(Number) as number,
                            result: "pass",
                          },
                        ]
                      : []),
                  ],
                } as TestRunRecord,
              ]),
          ...(skipQuarantined ||
          (expectQuarantinedTestsToBeSkipped && !failToFetchManifest) ||
          (testNamePattern !== undefined &&
            "mixed mixed: should be quarantined".match(testNamePattern) !==
              null)
            ? []
            : ([
                {
                  filename: "../integration-input/src/mixed.test.ts",
                  name: ["mixed", "mixed: should be quarantined"],
                  attempts: Array<TestRunAttemptRecord>(
                    expectedFailureRetries + 1
                  ).fill({
                    duration_ms: expect.any(Number) as number,
                    result:
                      failToFetchManifest ||
                      !expectQuarantinedTestsToBeQuarantined
                        ? "fail"
                        : "quarantined",
                  }),
                },
              ] as TestRunRecord[])),
          ...(skipFailures ||
          (testNamePattern !== undefined &&
            "mixed mixed: should fail".match(testNamePattern) !== null)
            ? []
            : ([
                {
                  filename: "../integration-input/src/mixed.test.ts",
                  name: ["mixed", "mixed: should fail"],
                  attempts: Array<TestRunAttemptRecord>(
                    expectedFailureRetries + 1
                  ).fill({
                    duration_ms: expect.any(Number) as number,
                    result: "fail",
                  }),
                },
              ] as TestRunRecord[])),
          ...(testNamePattern === undefined ||
          "mixed mixed: should pass".match(testNamePattern) === null
            ? [
                {
                  filename: "../integration-input/src/mixed.test.ts",
                  name: ["mixed", "mixed: should pass"],
                  attempts: [
                    {
                      duration_ms: expect.any(Number) as number,
                      result: "pass",
                    },
                  ],
                } as TestRunRecord,
              ]
            : []),
          ...(testNamePattern === undefined ||
          "should pass".match(testNamePattern) !== null
            ? [
                {
                  filename: "../integration-input/src/pass.test.ts",
                  name: ["should pass"],
                  attempts: [
                    {
                      duration_ms: expect.any(Number) as number,
                      result: "pass",
                    },
                  ],
                } as TestRunRecord,
              ]
            : []),
          ...(skipQuarantined ||
          (expectQuarantinedTestsToBeSkipped && !failToFetchManifest) ||
          (testNamePattern !== undefined &&
            "describe block should be quarantined".match(testNamePattern) ===
              null)
            ? []
            : ([
                {
                  filename: "../integration-input/src/quarantined.test.ts",
                  name: ["describe block", "should be quarantined"],
                  attempts: Array<TestRunAttemptRecord>(
                    expectedFailureRetries + 1
                  ).fill({
                    duration_ms: expect.any(Number) as number,
                    result:
                      failToFetchManifest ||
                      !expectQuarantinedTestsToBeQuarantined
                        ? "fail"
                        : "quarantined",
                  }),
                },
              ] as TestRunRecord[])),
        ].filter(
          (runRecord) =>
            testNamePatternRegex === undefined ||
            testNamePatternRegex.test(runRecord.name.join(" "))
        )
      ) as TestRunRecord[],
    });
    // Make sure there aren't any extra tests reported.
    expect(parsedBody.test_runs).toHaveLength(
      results.failedTests +
        results.flakyTests +
        results.quarantinedTests +
        results.passedTests
    );
    return true;
  };

const addFetchMockExpectations = (
  params: TestCaseParams,
  results: ResultCounts,
  fetchMock: jest.MockInstance<Response, MockCall> & FetchMockSandbox
) => {
  const {
    expectedApiKey,
    expectedBranch,
    expectedCommit,
    expectedFlakeTestNameSuffix,
    expectedSuiteId,
    expectResultsToBeUploaded,
    failToFetchManifest,
    failToUploadResults,
    quarantineFlake,
  } = params;
  fetchMock.getOnce(
    {
      url: `https://app.unflakable.com/api/v1/test-suites/${expectedSuiteId}/manifest`,
      headers: {
        Authorization: `Bearer ${expectedApiKey}`,
      },
      matcher: (_url, { headers }) => {
        expect((headers as { [key in string]: string })["User-Agent"]).toMatch(
          userAgentRegex
        );
        return true;
      },
    },
    failToFetchManifest
      ? {
          throws: new Error("mock request failure"),
        }
      : {
          body: {
            quarantined_tests: [
              {
                test_id: "TEST_QUARANTINED",
                filename: "../integration-input/src/quarantined.test.ts",
                name: ["describe block", "should be quarantined"],
              },
              {
                test_id: "TEST_QUARANTINED2",
                filename: "../integration-input/src/mixed.test.ts",
                name: ["mixed", "mixed: should be quarantined"],
              },
              ...(quarantineFlake
                ? [
                    {
                      test_id: "TEST_FLAKE",
                      filename: "../integration-input/src/flake.test.ts",
                      name: [
                        `should be flaky 1${expectedFlakeTestNameSuffix}`.substring(
                          0,
                          TEST_NAME_ENTRY_MAX_LENGTH
                        ),
                      ],
                    },
                    {
                      test_id: "TEST_FLAKE",
                      filename: "../integration-input/src/flake.test.ts",
                      name: [
                        `should be flaky 2${expectedFlakeTestNameSuffix}`.substring(
                          0,
                          TEST_NAME_ENTRY_MAX_LENGTH
                        ),
                      ],
                    },
                  ]
                : []),
            ],
          } as TestSuiteManifest,
          status: 200,
        }
  );
  if (expectResultsToBeUploaded) {
    fetchMock.postOnce(
      {
        url: `https://app.unflakable.com/api/v1/test-suites/${expectedSuiteId}/runs`,
        headers: {
          Authorization: `Bearer ${expectedApiKey}`,
          "Content-Type": "application/json",
        },
        matcher: uploadResultsMatcher(params, results),
      },
      (_url: string, { body }: MockRequest): MockResponse => {
        if (failToUploadResults) {
          return {
            throws: new Error("mock request failure"),
          };
        }

        const parsedBody = JSON.parse(
          body as string
        ) as CreateTestSuiteRunRequest;

        return {
          body: {
            run_id: "MOCK_RUN_ID",
            suite_id: expectedSuiteId,
            ...(expectedBranch !== undefined
              ? {
                  branch: expectedBranch,
                }
              : {}),
            ...(expectedCommit !== undefined
              ? {
                  commit: expectedCommit,
                }
              : {}),
            start_time: parsedBody.start_time,
            end_time: parsedBody.end_time,
            num_tests:
              results.failedTests +
              results.flakyTests +
              results.quarantinedTests +
              results.passedTests,
            num_pass: results.passedTests,
            num_fail: results.failedSuites,
            num_flake: results.flakyTests,
            num_quarantined: results.quarantinedSuites,
          } as TestSuiteRunSummary,
          status: 201,
        };
      }
    );
  }
};

const verifyOutput = (
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
  results: ResultCounts
) => {
  // Make sure expected output is present and chalk-formatted correctly.

  /* eslint-disable @typescript-eslint/unbound-method */

  // Test our VerboseReporter customization.
  (testNamePattern === undefined ||
    "should pass".match(testNamePattern) !== null
    ? expect(stderrLines).toContain
    : expect(stderrLines).not.toContain)(
    `${PASS} ${formatTestFilename("../integration-input/src/", "pass.test.ts")}`
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
    `${FAIL} ${formatTestFilename("../integration-input/src/", "fail.test.ts")}`
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
    }${FAIL} ${formatTestFilename(
      "../integration-input/src/",
      "flake.test.ts"
    )}`
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
    }${FAIL} ${formatTestFilename(
      "../integration-input/src/",
      "quarantined.test.ts"
    )}`
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
    `${FAIL} ${formatTestFilename(
      "../integration-input/src/",
      "mixed.test.ts"
    )}`
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
      results.failedSuites !== 0
        ? `\u001b[1m\u001b[31m${results.failedSuites} failed\u001b[39m\u001b[22m, `
        : ""
    }${
      results.quarantinedSuites !== 0
        ? `\u001b[1m\u001b[33m${results.quarantinedSuites} quarantined\u001b[39m\u001b[22m, `
        : ""
    }${
      results.skippedSuites !== 0
        ? `\u001b[1m\u001b[33m${results.skippedSuites} skipped\u001b[39m\u001b[22m, `
        : ""
    }${
      results.passedSuites !== 0
        ? `\u001b[1m\u001b[32m${results.passedSuites} passed\u001b[39m\u001b[22m, `
        : ""
    }${
      results.skippedSuites !== 0
        ? `${
            results.failedSuites +
            results.quarantinedSuites +
            results.passedSuites
          } of ${
            results.failedSuites +
            results.quarantinedSuites +
            results.passedSuites +
            results.skippedSuites
          }`
        : results.failedSuites +
          results.quarantinedSuites +
          results.passedSuites
    } total`
  );

  expect(stderrLines).toContain(
    `\u001b[1mTests:       \u001b[22m${
      results.failedTests !== 0
        ? `\u001b[1m\u001b[31m${results.failedTests} failed\u001b[39m\u001b[22m, `
        : ""
    }${
      results.flakyTests !== 0
        ? `\u001b[1m\u001b[95m${results.flakyTests} flaky\u001b[39m\u001b[22m, `
        : ""
    }${
      results.quarantinedTests !== 0
        ? `\u001b[1m\u001b[33m${results.quarantinedTests} quarantined\u001b[39m\u001b[22m, `
        : ""
    }${
      results.skippedTests !== 0
        ? `\u001b[1m\u001b[33m${results.skippedTests} skipped\u001b[39m\u001b[22m, `
        : ""
    }${
      results.passedTests !== 0
        ? `\u001b[1m\u001b[32m${results.passedTests} passed\u001b[39m\u001b[22m, `
        : ""
    }${
      results.failedTests +
      results.flakyTests +
      results.quarantinedTests +
      results.passedTests +
      results.skippedTests
    } total`
  );

  expect(stderrLines).toContain(
    `\u001b[1mSnapshots:   \u001b[22m${
      results.failedSnapshots > 0
        ? `\u001b[1m\u001b[31m${results.failedSnapshots} failed\u001b[39m\u001b[22m, `
        : ""
    }${
      results.passedSnapshots > 0
        ? `\u001b[1m\u001b[32m${results.passedSnapshots} passed\u001b[39m\u001b[22m, `
        : ""
    }${results.totalSnapshots} total`
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
    `Unflakable report: https://app.unflakable.com/test-suites/${expectedSuiteId}/runs/MOCK_RUN_ID`
  );
};

export const runTestCase = async (
  params: TestCaseParams,
  expectedExitCode: number,
  expectedResults: ResultCounts,
  mockConfigExplorer: ReturnType<typeof cosmiconfig.cosmiconfigSync>,
  mockExit: jest.Mock,
  fetchMock: jest.MockInstance<Response, MockCall> & FetchMockSandbox
): Promise<void> => {
  const {
    expectPluginToBeEnabled,
    failToUploadResults,
    git,
    skipFailures,
    skipFlake,
    skipQuarantined,
    testNamePattern,
  } = params;

  (mockConfigExplorer.search as jest.Mock).mockImplementation(
    (searchFrom?: string): CosmiconfigResult => {
      expect(searchFrom).toMatch(
        new RegExp("packages/jest-plugin/test/integration-input$")
      );
      return params.config !== null
        ? {
            config: params.config,
            filepath:
              "MOCK_BASE/packages/jest-plugin/test/integration-input/package.json",
          }
        : null;
    }
  );

  // Force color even if running in CI that doesn't support it (since we want to be sure that our
  // output uses the expected colors).
  chalk.level = 3;
  chalk.supportsColor = {
    level: 3,
    hasBasic: true,
    has256: true,
    has16m: true,
  };
  chalk.stderr.level = 3;
  chalk.stderr.supportsColor = {
    level: 3,
    hasBasic: true,
    has256: true,
    has16m: true,
  };
  mockSimpleGit(git);

  const results = countResults(params);

  // The flaky test needs external state to know when it's being retried so that it can pass.
  process.env.FLAKY_TEST_TEMP = temp.path();

  if (skipFailures) {
    process.env.SKIP_FAILURES = "true";
  } else {
    delete process.env.SKIP_FAILURES;
  }

  if (skipFlake) {
    process.env.SKIP_FLAKE = "true";
  } else {
    delete process.env.SKIP_FLAKE;
  }

  if (skipQuarantined) {
    process.env.SKIP_QUARANTINED = "true";
  } else {
    delete process.env.SKIP_QUARANTINED;
  }

  Object.entries(params.envVars).forEach(([name, value]) => {
    if (value !== undefined) {
      process.env[name] = value;
    } else {
      delete process.env[name];
    }
  });

  if (expectPluginToBeEnabled) {
    addFetchMockExpectations(params, results, fetchMock);
  }

  let stderrLines: (Uint8Array | string)[] = [];
  process.stderr.write = jest.fn(
    (
      buffer: Uint8Array | string,
      encoding?: BufferEncoding,
      cb?: (err?: Error) => void
    ): boolean => {
      stderrLines = [
        ...stderrLines,
        ...(typeof buffer === "string"
          ? buffer.split("\n")
          : [JSON.stringify(buffer)]),
      ];
      // split() adds an empty string if the delimiter is the last character; remove it here.
      if (stderrLines[stderrLines.length - 1] === "") {
        stderrLines.pop();
      }
      //originalStderrWrite(JSON.stringify(buffer));
      return originalStderrWrite(buffer, encoding, cb);
    }
  ) as typeof process.stderr.write;

  try {
    const runPromise = run(
      [
        // Needed so that exit() gets called and we can assert that it's the correct exit code.
        // NB: Despite the warning, we don't pass --detectOpenHandles since that would also enable
        // --runInBand and not test the plugin's ability to deal with parallel tests.
        "--forceExit",
        // --no-cache disables the cache that stores the past timings, which makes the output
        // non-deterministic since it gets bolded if it exceeds the expected time.
        "--no-cache",
        ...(skipFailures
          ? [
              "--testPathIgnorePatterns",
              "../integration-input/src/invalid\\.test\\.ts",
            ]
          : []),
        ...(testNamePattern !== undefined
          ? ["--testNamePattern", testNamePattern]
          : []),
      ],
      "../integration-input"
    );

    if (failToUploadResults) {
      await expect(runPromise).rejects.toThrow();
    } else {
      await expect(runPromise).resolves.not.toThrow();
    }
  } finally {
    process.stderr.write = originalStderrWrite;
  }

  expect(fetchMock).toBeDone();

  expect(results).toEqual(expectedResults);
  verifyOutput(params, stderrLines, results);

  expect(mockExit).toHaveBeenCalledTimes(1);
  expect(mockExit).toHaveBeenCalledWith(expectedExitCode);
};
