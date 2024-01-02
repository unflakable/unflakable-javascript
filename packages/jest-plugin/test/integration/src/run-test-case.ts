// Copyright (c) 2022-2024 Developer Innovations, LLC

import { tmpName, TmpNameOptions } from "tmp";
import {
  CreateTestSuiteRunInlineRequest,
  TEST_NAME_ENTRY_MAX_LENGTH,
  TestRunRecord,
  TestSuiteManifest,
} from "@unflakable/js-api";
import { gunzipSync } from "zlib";
import { UnflakableConfig } from "@unflakable/plugins-common";
import { verifyOutput } from "./verify-output";
import {
  CONFIG_MOCK_ENV_VAR,
  CosmiconfigMockParams,
} from "unflakable-test-common/dist/config";
import path from "path";
import { promisify } from "es6-promisify";
import { execFile } from "child_process";
import {
  MockBackend,
  UnmatchedEndpoints,
} from "unflakable-test-common/dist/mock-backend";
import { CompletedRequest } from "mockttp";
import { GIT_MOCK_ENV_VAR } from "unflakable-test-common/dist/git";
import {
  AsyncTestError,
  spawnTestWithTimeout,
} from "unflakable-test-common/dist/spawn";
import * as util from "util";
import * as fs from "fs/promises";

// Jest times out after 120 seconds, so we bail early here to allow time to print the
// captured output before Jest kills the test.
const TEST_TIMEOUT_MS = 110000;

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
      repoRoot: string;
    };

export type TestCaseParams = {
  config: Partial<UnflakableConfig> | null;
  configJs: string | null;
  envVars: { [key in string]: string | undefined };
  expectedApiKey: string;
  expectedBranch: string | undefined;
  expectedCommit: string | undefined;
  expectedFailureRetries: number;
  expectedFlakeTestNameSuffix: string;
  expectedSuiteId: string;
  expectedRepoRelativePathPrefix: string;
  expectFailuresToBeTestIndependent: boolean;
  expectFailuresFirstAttemptToBeTestIndependent: boolean;
  expectFlakeToBeTestIndependent: boolean;
  expectFlakeFirstAttemptToBeTestIndependent: boolean;
  expectPluginToBeEnabled: boolean;
  expectResultsToBeUploaded: boolean;
  expectQuarantinedTestsToBeQuarantined: boolean;
  expectQuarantinedTestsToBeSkipped: boolean;
  expectQuarantinedTestsToBeTestIndependent: boolean;
  expectQuarantinedTestsFirstAttemptToBeTestIndependent: boolean;
  expectSnapshots: boolean;
  failToFetchManifest: boolean;
  failToUploadResults: boolean;
  flakeFailCount: number;
  git: SimpleGitMockParams;
  quarantineFlake: boolean;
  skipFailures: boolean;
  skipFlake: boolean;
  skipQuarantined: boolean;
  testNamePattern: string | undefined;
};

const specRepoPath = (params: TestCaseParams, specNameStub: string): string =>
  `${params.expectedRepoRelativePathPrefix}src/${specNameStub}.test.ts`;

export const MOCK_RUN_ID = "MOCK_RUN_ID";
const TIMESTAMP_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

export type ResultCounts = {
  passedSuites: number;
  passedSuitesWithIndependentFailures: number;
  passedTests: number;
  passedTestsWithIndependentFailures: number;
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

const verifyUploadResults = (
  params: TestCaseParams,
  expectedResults: ResultCounts,
  request: CompletedRequest
): void => {
  const {
    expectFailuresFirstAttemptToBeTestIndependent,
    expectFailuresToBeTestIndependent,
    expectFlakeFirstAttemptToBeTestIndependent,
    expectFlakeToBeTestIndependent,
    expectQuarantinedTestsFirstAttemptToBeTestIndependent,
    expectQuarantinedTestsToBeQuarantined,
    expectQuarantinedTestsToBeSkipped,
    expectQuarantinedTestsToBeTestIndependent,
    expectedBranch,
    expectedCommit,
    expectedFailureRetries,
    expectedFlakeTestNameSuffix,
    failToFetchManifest,
    flakeFailCount,
    quarantineFlake,
    skipFailures,
    skipFlake,
    skipQuarantined,
    testNamePattern,
  } = params;

  const parsedBody = JSON.parse(
    gunzipSync(request.body.buffer).toString()
  ) as CreateTestSuiteRunInlineRequest;

  expect(request.headers["user-agent"]).toMatch(userAgentRegex);

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
    start_time: expect.stringMatching(TIMESTAMP_REGEX) as string,
    end_time: expect.stringMatching(TIMESTAMP_REGEX) as string,
    test_runs: expect.arrayContaining<TestRunRecord>(
      [
        ...(skipFailures
          ? ([] as TestRunRecord[])
          : ([
              {
                filename: specRepoPath(params, "fail"),
                name: ["describe block", "should ([escape regex]?.*$ fail"],
                attempts: Array(expectedFailureRetries + 1)
                  .fill(0)
                  .map((_, idx) => ({
                    duration_ms: expect.any(Number) as number,
                    result: "fail",
                    ...(expectFailuresToBeTestIndependent ||
                    (expectFailuresFirstAttemptToBeTestIndependent && idx === 0)
                      ? {
                          failure_reason: "independent",
                        }
                      : {}),
                  })),
              },
            ] as TestRunRecord[])),
        ...[1, 2].flatMap((i) =>
          skipFlake ||
          (expectQuarantinedTestsToBeSkipped &&
            quarantineFlake &&
            !failToFetchManifest) ||
          (testNamePattern !== undefined &&
            `should be flaky ${i}${expectedFlakeTestNameSuffix}`.match(
              testNamePattern
            ) === null)
            ? []
            : [
                {
                  filename: specRepoPath(params, "flake"),
                  name: [
                    `should be flaky ${i}${expectedFlakeTestNameSuffix}`.substring(
                      0,
                      TEST_NAME_ENTRY_MAX_LENGTH
                    ),
                  ],
                  attempts: [
                    ...Array(flakeFailCount)
                      .fill(0)
                      .map((_, idx) => ({
                        duration_ms: expect.any(Number) as number,
                        result:
                          quarantineFlake &&
                          !failToFetchManifest &&
                          expectQuarantinedTestsToBeQuarantined
                            ? "quarantined"
                            : "fail",
                        ...(expectFlakeToBeTestIndependent ||
                        (expectFlakeFirstAttemptToBeTestIndependent &&
                          idx === 0)
                          ? {
                              failure_reason: "independent",
                            }
                          : {}),
                      })),
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
              ]
        ),
        ...(skipQuarantined ||
        (expectQuarantinedTestsToBeSkipped && !failToFetchManifest) ||
        (testNamePattern !== undefined &&
          "mixed mixed: should be quarantined".match(testNamePattern) !== null)
          ? []
          : ([
              {
                filename: specRepoPath(params, "mixed"),
                name: ["mixed", "mixed: should be quarantined"],
                attempts: Array(expectedFailureRetries + 1)
                  .fill(0)
                  .map((_, idx) => ({
                    duration_ms: expect.any(Number) as number,
                    result:
                      failToFetchManifest ||
                      !expectQuarantinedTestsToBeQuarantined
                        ? "fail"
                        : "quarantined",
                    ...(expectQuarantinedTestsToBeTestIndependent ||
                    (expectQuarantinedTestsFirstAttemptToBeTestIndependent &&
                      idx === 0)
                      ? {
                          failure_reason: "independent",
                        }
                      : {}),
                  })),
              },
            ] as TestRunRecord[])),
        ...(skipFailures ||
        (testNamePattern !== undefined &&
          "mixed mixed: should fail".match(testNamePattern) !== null)
          ? []
          : ([
              {
                filename: specRepoPath(params, "mixed"),
                name: ["mixed", "mixed: should fail"],
                attempts: Array(expectedFailureRetries + 1)
                  .fill(0)
                  .map((_, idx) => ({
                    duration_ms: expect.any(Number) as number,
                    result: "fail",
                    ...(expectFailuresToBeTestIndependent ||
                    (expectFailuresFirstAttemptToBeTestIndependent && idx === 0)
                      ? {
                          failure_reason: "independent",
                        }
                      : {}),
                  })),
              },
            ] as TestRunRecord[])),
        ...(testNamePattern === undefined ||
        "mixed mixed: should pass".match(testNamePattern) === null
          ? [
              {
                filename: specRepoPath(params, "mixed"),
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
                filename: specRepoPath(params, "pass"),
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
                filename: specRepoPath(params, "quarantined"),
                name: ["describe block", "should be quarantined"],
                attempts: Array(expectedFailureRetries + 1)
                  .fill(0)
                  .map((_, idx) => ({
                    duration_ms: expect.any(Number) as number,
                    result:
                      failToFetchManifest ||
                      !expectQuarantinedTestsToBeQuarantined
                        ? "fail"
                        : "quarantined",
                    ...(expectQuarantinedTestsToBeTestIndependent ||
                    (expectQuarantinedTestsFirstAttemptToBeTestIndependent &&
                      idx === 0)
                      ? {
                          failure_reason: "independent",
                        }
                      : {}),
                  })),
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
    expectedResults.failedTests +
      expectedResults.flakyTests +
      expectedResults.quarantinedTests +
      expectedResults.passedTests
  );
};

const addBackendExpectations = async (
  params: TestCaseParams,
  expectedResults: ResultCounts,
  mockBackend: MockBackend,
  onError: (e: unknown) => void
): Promise<UnmatchedEndpoints> => {
  const {
    expectedApiKey,
    expectedBranch,
    expectedCommit,
    expectedFlakeTestNameSuffix,
    expectedSuiteId,
    expectPluginToBeEnabled,
    expectResultsToBeUploaded,
    failToFetchManifest,
    failToUploadResults,
    quarantineFlake,
  } = params;

  const manifest: TestSuiteManifest = {
    quarantined_tests: [
      {
        test_id: "TEST_QUARANTINED",
        filename: specRepoPath(params, "quarantined"),
        name: ["describe block", "should be quarantined"],
      },
      {
        test_id: "TEST_QUARANTINED2",
        filename: specRepoPath(params, "mixed"),
        name: ["mixed", "mixed: should be quarantined"],
      },
      ...(quarantineFlake
        ? [
            {
              test_id: "TEST_FLAKE",
              filename: specRepoPath(params, "flake"),
              name: [
                `should be flaky 1${expectedFlakeTestNameSuffix}`.substring(
                  0,
                  TEST_NAME_ENTRY_MAX_LENGTH
                ),
              ],
            },
            {
              test_id: "TEST_FLAKE",
              filename: specRepoPath(params, "flake"),
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
  };

  return mockBackend.addExpectations(
    onError,
    failToFetchManifest ? null : manifest,
    (request) => verifyUploadResults(params, expectedResults, request),
    failToUploadResults
      ? null
      : {
          run_id: MOCK_RUN_ID,
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
        },
    userAgentRegex,
    {
      expectPluginToBeEnabled,
      expectResultsToBeUploaded,
      expectedApiKey,
      expectedSuiteId,
    }
  );
};

export const runTestCase = async (
  params: TestCaseParams,
  expectedExitCode: number,
  expectedResults: ResultCounts,
  mockBackend: MockBackend
): Promise<void> => {
  const {
    flakeFailCount,
    git,
    skipFailures,
    skipFlake,
    skipQuarantined,
    testNamePattern,
  } = params;

  const asyncTestError: AsyncTestError = { error: undefined };

  const unmatchedRequestEndpoints = await addBackendExpectations(
    params,
    expectedResults,
    mockBackend,
    (error) => {
      if (asyncTestError.error === undefined) {
        asyncTestError.error = error ?? new Error("undefined error");
      } else {
        console.error("Multiple failed fetch expectations", error);
      }
    }
  );

  const configPath =
    params.configJs !== null
      ? (await promisify<string, TmpNameOptions>(tmpName)({
          prefix: "unflakable-jest-integration-config",
        })) + ".js"
      : null;
  if (configPath !== null) {
    await fs.writeFile(
      configPath,
      Buffer.from(params.configJs as string, "utf8")
    );
  }

  const integrationInputPath = path.join("..", "integration-input");
  const configMockParams: CosmiconfigMockParams =
    configPath !== null
      ? {
          expectedSearchFrom: path.resolve(integrationInputPath),
          pathToLoad: configPath,
        }
      : {
          expectedSearchFrom: path.resolve(integrationInputPath),
          searchResult:
            params.config !== null
              ? {
                  config: params.config,
                  filepath: path.join(
                    "MOCK_BASE",
                    "packages",
                    "jest-plugin",
                    "test",
                    "integration-input",
                    "package.json"
                  ),
                }
              : null,
        };

  // We don't directly invoke `jest` because we need to pass `--require` to Node.JS in order to
  // mock cosmiconfig for testing. Instead, we resolve the binary to an absolute path using `yarn
  // bin` and then invoke node directly.
  const jestBin = (
    await util.promisify(execFile)("yarn", ["bin", "jest"], {
      cwd: integrationInputPath,
      // yarn.CMD isn't executable without a shell on Windows.
      shell: process.platform === "win32",
    })
  ).stdout.trimEnd();

  const args = [
    "--require",
    require.resolve("./force-color.js"),
    "--require",
    require.resolve("unflakable-test-common/dist/mock-cosmiconfig"),
    "--require",
    require.resolve("unflakable-test-common/dist/mock-git"),
    // Uncomment to enable debugger.
    // "--inspect",
    jestBin,
    "--reporters",
    "@unflakable/jest-plugin/dist/reporter",
    "--runner",
    "@unflakable/jest-plugin/dist/runner",
    "--testRunner",
    "@unflakable/jest-plugin/dist/test-runner",
    ...(skipFailures
      ? ["--testPathIgnorePatterns", "<rootDir>/src/invalid\\.test\\.ts"]
      : []),
    ...(testNamePattern !== undefined
      ? ["--testNamePattern", testNamePattern]
      : []),
  ];

  const env = {
    ...params.envVars,
    DEBUG: process.env.TEST_DEBUG,
    // The flaky test needs external state to know when it's being retried so that it can pass.
    FLAKY_TEST_TEMP: await promisify<string, TmpNameOptions>(tmpName)({
      prefix: "unflakable-jest-integration-flaky-test",
    }),
    PATH: process.env.PATH,
    UNFLAKABLE_API_BASE_URL: `http://localhost:${mockBackend.apiServerPort}`,
    [CONFIG_MOCK_ENV_VAR]: JSON.stringify(configMockParams),
    [GIT_MOCK_ENV_VAR]: JSON.stringify(git),
    ...(skipFailures ? { SKIP_FAILURES: "1" } : {}),
    ...(skipFlake ? { SKIP_FLAKE: "1" } : {}),
    ...(skipQuarantined ? { SKIP_QUARANTINED: "1" } : {}),
    FLAKE_FAIL_COUNT: flakeFailCount.toString(),
    // Windows requires these environment variables to be propagated.
    ...(process.platform === "win32"
      ? {
          APPDATA: process.env.APPDATA,
          LOCALAPPDATA: process.env.LOCALAPPDATA,
          TMP: process.env.TMP,
          TEMP: process.env.TEMP,
        }
      : {}),
  };

  await spawnTestWithTimeout(
    args,
    env,
    integrationInputPath,
    TEST_TIMEOUT_MS,
    async (_stdoutLines, stderrLines) => {
      verifyOutput(
        params,
        stderrLines,
        expectedResults,
        mockBackend.apiServerPort
      );
      await mockBackend.checkExpectations(unmatchedRequestEndpoints);
    },
    expectedExitCode,
    true,
    asyncTestError
  );
};
