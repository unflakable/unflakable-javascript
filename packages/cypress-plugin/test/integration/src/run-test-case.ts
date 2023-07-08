// Copyright (c) 2023 Developer Innovations, LLC

import {
  CreateTestSuiteRunInlineRequest,
  TEST_NAME_ENTRY_MAX_LENGTH,
  TestAttemptResult,
  TestRunRecord,
} from "@unflakable/js-api";
import { gunzipSync } from "zlib";
import { UnflakableConfig } from "@unflakable/plugins-common";
import { CompletedRequest } from "mockttp";
import _debug from "debug";
import { execFile } from "child_process";
import { promisify } from "util";
import {
  CONFIG_MOCK_ENV_VAR,
  CosmiconfigMockParams,
} from "unflakable-test-common/dist/config";
import {
  GIT_MOCK_ENV_VAR,
  SimpleGitMockParams,
} from "unflakable-test-common/dist/git";
import path from "path";
import { SummaryTotals } from "./parse-output";
import { expect as expectExt } from "@jest/globals";
import "./matchers";
import { verifyOutput } from "./verify-output";
import {
  MockBackend,
  UnmatchedEndpoints,
} from "unflakable-test-common/dist/mock-backend";
import {
  AsyncTestError,
  spawnTestWithTimeout,
} from "unflakable-test-common/dist/spawn";

// Jest times out after 120 seconds, so we bail early here to allow time to print the
// captured output before Jest kills the test.
const TEST_TIMEOUT_MS = 110000;

const userAgentRegex = new RegExp(
  "unflakable-js-api/(?:[-0-9.]|alpha|beta)+ unflakable-cypress-plugin/(?:[-0-9.]|alpha|beta)+ \\(Cypress [0-9]+\\.[0-9]+\\.[0-9]+; Node v[0-9]+\\.[0-9]+\\.[0-9]\\)"
);

export type TestMode = "component" | "e2e";

export type TestProjectName =
  | "integration-input"
  | "integration-input-esm"
  | "integration-input-manual";

export type TestProject = {
  configFiles: string[];
};

export const TEST_PROJECTS: { [key in TestProjectName]: TestProject } = {
  "integration-input": {
    configFiles: [
      "cypress.config.ts",
      "cypress-config.js",
      "cypress-config.mjs",
    ],
  },
  "integration-input-esm": {
    configFiles: [
      "cypress.config.ts",
      "cypress-config.cjs",
      "cypress-config.js",
    ],
  },
  "integration-input-manual": {
    configFiles: ["cypress.config.js", "cypress-config.mjs"],
  },
};

export const TEST_SPEC_STUBS = [
  "fail",
  "flake",
  "hook-fail",
  "invalid",
  "mixed/mixed",
  "pass",
  "pending",
  "quarantined",
];

export type TestCaseParams = {
  cliArgs: string[];
  config: Partial<UnflakableConfig> | null;
  configFile: string;
  envVars: { [key in string]: string | undefined };
  testEnvVars: { [key in string]: string };
  expectedApiKey: string;
  expectedBranch: string | undefined;
  expectedCommit: string | undefined;
  expectedFlakeTestNameSuffix: string;
  expectedSuiteId: string;
  expectedRepoRelativePathPrefix: string;
  expectedRetries: number;
  expectPluginToBeEnabled: boolean;
  expectResultsToBeUploaded: boolean;
  expectQuarantinedTestsToBeQuarantined: boolean;
  expectQuarantinedTestsToBeSkipped: boolean;
  failToFetchManifest: boolean;
  failToUploadResults: boolean;
  git: SimpleGitMockParams;
  project: TestProjectName;
  quarantineFlake: boolean;
  quarantineHookFail: boolean;
  quarantineHookSkip: boolean;

  skipFailures: boolean;
  skipFlake: boolean;
  skipQuarantined: boolean;

  skipBeforeHook: boolean;
  skipBeforeEachHook: boolean;
  skipAfterEachHook: boolean;
  skipAfterHook: boolean;
  hookAndTestErrors: boolean;
  multipleHookErrors: boolean;

  // Array of spec names to pass to --spec. These should just be the stubs (e.g., "pass" or "fail").
  // The full spec path becomes `cypress/<testMode>/<specNameStub>.cy.<ts|js>`.
  specNameStubs: string[] | undefined;
  testMode: TestMode;
};

export const projectPath = (params: TestCaseParams): string =>
  path.join("..", params.project);

export const specFilename = (
  params: TestCaseParams,
  specNameStub: string
): string =>
  `${specNameStub}.cy.${
    params.project === "integration-input-manual" ? "js" : "ts"
  }`;

export const specProjectPath = (
  params: TestCaseParams,
  specNameStub: string
): string => `cypress/${params.testMode}/${specFilename(params, specNameStub)}`;

export const specPattern = (params: TestCaseParams): string => {
  const { specNameStubs, testMode } = params;
  return specNameStubs !== undefined && specNameStubs.length > 0
    ? // Cypress doesn't convert to relative path on Windows due to hard-coding a forward slash
      // into the path. See:
      // https://github.com/cypress-io/cypress/blob/3d0a2b406115db292130df774348c4f1fd4a3240/packages/server/lib/modes/run.ts#L52
      specNameStubs
        .map((stub) =>
          process.platform === "win32"
            ? `${path.resolve(projectPath(params))}\\${specProjectPath(
                params,
                stub
              ).replaceAll("/", "\\")}`
            : specProjectPath(params, stub)
        )
        .join(", ")
    : testMode === "component"
    ? "**/*.cy.{js,jsx,ts,tsx}"
    : `cypress/e2e/**/*.cy.{js,jsx,ts,tsx}`;
};

const specRepoPath = (params: TestCaseParams, specNameStub: string): string =>
  params.expectedRepoRelativePathPrefix + specProjectPath(params, specNameStub);

export const mockBackend = new MockBackend();

export const MOCK_RUN_ID = "MOCK_RUN_ID";
const TIMESTAMP_REGEX =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3}Z$/;

type ExpectedRunRecord = {
  name: string[];
  attemptResults: TestAttemptResult[];
};

const expectSpecRuns = (
  params: TestCaseParams,
  specNameStub: string,
  expectedRunRecords: ExpectedRunRecord[]
): TestRunRecord[] =>
  params.specNameStubs === undefined ||
  params.specNameStubs.includes(specNameStub)
    ? expectedRunRecords.map(({ name, attemptResults }) => ({
        attempts: attemptResults.map((result) => ({
          start_time: expectExt.stringMatching(TIMESTAMP_REGEX),
          duration_ms: expectExt.toBeAnInteger(),
          result,
        })),
        filename: specRepoPath(params, specNameStub),
        name,
      }))
    : [];

const verifyUploadResults = (
  params: TestCaseParams,
  summaryTotals: SummaryTotals,
  request: CompletedRequest
): void => {
  const {
    expectedBranch,
    expectedCommit,
    expectedRetries,
    expectedFlakeTestNameSuffix,
    expectQuarantinedTestsToBeQuarantined,
    expectQuarantinedTestsToBeSkipped,
    hookAndTestErrors,
    quarantineFlake,
    quarantineHookFail,
    quarantineHookSkip,
    skipBeforeHook,
    skipBeforeEachHook,
    skipAfterEachHook,
    skipAfterHook,
    skipFailures,
    skipFlake,
    skipQuarantined,
  } = params;

  const parsedBody = JSON.parse(
    gunzipSync(request.body.buffer).toString()
  ) as CreateTestSuiteRunInlineRequest;

  expect(request.headers["user-agent"]).toMatch(userAgentRegex);

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

  expect(parsedBody).toStrictEqual({
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
    start_time: expectExt.stringMatching(TIMESTAMP_REGEX),
    end_time: expectExt.stringMatching(TIMESTAMP_REGEX),
    test_runs: [
      ...(!skipFailures
        ? expectSpecRuns(params, "fail", [
            {
              name: ["describe block", "inner block", "should showDiff"],
              attemptResults: Array.from(
                { length: expectedRetries + 1 },
                () => "fail"
              ),
            },
            {
              name: ["describe block", "should fail"],
              attemptResults: Array.from(
                { length: expectedRetries + 1 },
                () => "fail"
              ),
            },
            {
              name: ["describe block", "should fail with multiple exceptions"],
              attemptResults: Array.from(
                { length: expectedRetries + 1 },
                () => "fail"
              ),
            },
          ])
        : []),
      ...(!skipFlake && (!quarantineFlake || !expectQuarantinedTestsToBeSkipped)
        ? expectSpecRuns(params, "flake", [
            {
              name: [
                `should be flaky${expectedFlakeTestNameSuffix}`.substring(
                  0,
                  TEST_NAME_ENTRY_MAX_LENGTH
                ),
              ],
              attemptResults: [
                quarantineFlake && expectQuarantinedTestsToBeQuarantined
                  ? "quarantined"
                  : "fail",
                ...(expectedRetries > 0 ? ["pass"] : []),
              ] as TestAttemptResult[],
            },
          ])
        : []),
      ...expectSpecRuns(params, "hook-fail", [
        ...(skipBeforeHook &&
        ((skipBeforeEachHook && skipAfterEachHook) || !skipAfterHook)
          ? [
              {
                name: ["describe block", "should be skipped"],
                attemptResults: [
                  skipAfterHook
                    ? "pass"
                    : quarantineHookSkip
                    ? "quarantined"
                    : "fail",
                ] as TestAttemptResult[],
              },
            ]
          : []),
        {
          name: ["describe block", "should fail due to hook"],
          attemptResults:
            skipBeforeHook &&
            skipBeforeEachHook &&
            skipAfterEachHook &&
            !hookAndTestErrors
              ? ["pass"]
              : Array.from(
                  {
                    length:
                      skipBeforeHook &&
                      (!skipBeforeEachHook ||
                        !skipAfterEachHook ||
                        hookAndTestErrors)
                        ? expectedRetries + 1
                        : 1,
                  },
                  () => (quarantineHookFail ? "quarantined" : "fail")
                ),
        },
      ]),
      ...(!skipFailures
        ? expectSpecRuns(params, "invalid", [
            {
              name: ["An uncaught error was detected outside of a test"],
              attemptResults: Array.from(
                { length: expectedRetries + 1 },
                () => "fail"
              ),
            },
          ])
        : []),
      ...expectSpecRuns(params, "mixed/mixed", [
        ...(!skipQuarantined && !expectQuarantinedTestsToBeSkipped
          ? [
              {
                name: [
                  "spec with mixed test results",
                  "mixed: failure should be quarantined",
                ],
                attemptResults: Array.from(
                  { length: expectedRetries + 1 },
                  () =>
                    expectQuarantinedTestsToBeQuarantined
                      ? "quarantined"
                      : "fail"
                ),
              },
              {
                name: [
                  "spec with mixed test results",
                  "mixed: flake should be quarantined",
                ],
                attemptResults: [
                  expectQuarantinedTestsToBeQuarantined
                    ? "quarantined"
                    : "fail",
                  ...(expectedRetries > 0 ? ["pass"] : []),
                ] as TestAttemptResult[],
              },
            ]
          : []),
        ...(!skipFlake &&
        (!quarantineFlake || !expectQuarantinedTestsToBeSkipped)
          ? [
              {
                name: [
                  "spec with mixed test results",
                  "mixed: should be flaky",
                ],
                attemptResults: [
                  quarantineFlake && expectQuarantinedTestsToBeQuarantined
                    ? "quarantined"
                    : "fail",
                  ...(expectedRetries > 0 ? ["pass"] : []),
                ] as TestAttemptResult[],
              },
            ]
          : []),
        ...(!skipFailures
          ? [
              {
                name: ["spec with mixed test results", "mixed: should fail"],
                attemptResults: Array.from(
                  { length: expectedRetries + 1 },
                  () => "fail" as TestAttemptResult
                ),
              },
            ]
          : []),
        {
          name: ["spec with mixed test results", "mixed: should pass"],
          attemptResults: ["pass"],
        },
      ]),
      ...expectSpecRuns(params, "pass", [
        {
          name: ["should pass"],
          attemptResults: ["pass"],
        },
        {
          name: ["suite name", "suite test should pass"],
          attemptResults: ["pass"],
        },
      ]),
      ...(!skipQuarantined && !expectQuarantinedTestsToBeSkipped
        ? expectSpecRuns(params, "quarantined", [
            {
              name: ["describe block", "should be quarantined"],
              attemptResults: Array.from({ length: expectedRetries + 1 }, () =>
                expectQuarantinedTestsToBeQuarantined ? "quarantined" : "fail"
              ),
            },
          ])
        : []),
    ],
  });
  // Make sure there aren't any extra tests reported.
  expect(parsedBody.test_runs).toHaveLength(
    summaryTotals.numFailing +
      summaryTotals.numFlaky +
      (!expectQuarantinedTestsToBeSkipped ? summaryTotals.numQuarantined : 0) +
      summaryTotals.numPassing
  );
};

const addBackendExpectations = async (
  params: TestCaseParams,
  summaryTotals: SummaryTotals,
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
    quarantineHookFail,
    quarantineHookSkip,
  } = params;

  const manifest = {
    quarantined_tests: [
      {
        test_id: "TEST_QUARANTINED",
        filename: specRepoPath(params, "quarantined"),
        name: ["describe block", "should be quarantined"],
      },
      {
        test_id: "TEST_MIXED_QUARANTINED_FAIL",
        filename: specRepoPath(params, "mixed/mixed"),
        name: [
          "spec with mixed test results",
          "mixed: failure should be quarantined",
        ],
      },
      {
        test_id: "TEST_MIXED_QUARANTINED_FLAKE",
        filename: specRepoPath(params, "mixed/mixed"),
        name: [
          "spec with mixed test results",
          "mixed: flake should be quarantined",
        ],
      },
      {
        test_id: "TEST_QUARANTINED_PENDING",
        filename: specRepoPath(params, "pending"),
        name: ["suite name", "suite test should be quarantined and pending"],
      },
      ...(quarantineFlake
        ? [
            {
              test_id: "TEST_FLAKE",
              filename: specRepoPath(params, "flake"),
              name: [
                `should be flaky${expectedFlakeTestNameSuffix}`.substring(
                  0,
                  TEST_NAME_ENTRY_MAX_LENGTH
                ),
              ],
            },
            {
              test_id: "TEST_MIXED_FLAKE",
              filename: specRepoPath(params, "mixed/mixed"),
              name: ["spec with mixed test results", "mixed: should be flaky"],
            },
          ]
        : []),
      ...(quarantineHookFail
        ? [
            {
              test_id: "TEST_HOOK_FAIL",
              filename: specRepoPath(params, "hook-fail"),
              name: ["describe block", "should fail due to hook"],
            },
          ]
        : []),
      ...(quarantineHookSkip
        ? [
            {
              test_id: "TEST_HOOK_SKIP",
              filename: specRepoPath(params, "hook-fail"),
              name: ["describe block", "should be skipped"],
            },
          ]
        : []),
    ],
  };

  return mockBackend.addExpectations(
    onError,
    failToFetchManifest ? null : manifest,
    (request) => verifyUploadResults(params, summaryTotals, request),
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

// Similar to debug's default formatter, but with timestamps instead of the +Nms at the end of each
// call, which messes up Cypress's multi-line output.
function formatDebugArgsWithTimestamp(
  this: _debug.Debugger & { useColors?: boolean },
  args: unknown[]
): void {
  const { namespace: name, useColors } = this;

  const now = new Date().toISOString();
  if (useColors === true) {
    const c = this.color as unknown as number;
    const colorCode = "\x1B[3" + (c < 8 ? c.toString() : "8;5;" + c.toString());
    const prefix = `  ${colorCode};1m${now} ${name} \x1B[0m`;

    args[0] = `${prefix}${(args[0] as string).split("\n").join(`\n${prefix}`)}`;
  } else {
    args[0] = `${now} ${name} ${args[0] as string}`;
  }
}

_debug.formatArgs = formatDebugArgsWithTimestamp;

export const runTestCase = async (
  params: TestCaseParams,
  expectedExitCode: number,
  summaryTotals: SummaryTotals
): Promise<void> => {
  const {
    skipFailures,
    skipFlake,
    skipQuarantined,
    skipBeforeHook,
    skipBeforeEachHook,
    skipAfterEachHook,
    skipAfterHook,
    hookAndTestErrors,
    multipleHookErrors,
  } = params;

  const asyncTestError: AsyncTestError = { error: undefined };

  const unmatchedRequestEndpoints = await addBackendExpectations(
    params,
    summaryTotals,
    (error) => {
      if (asyncTestError.error === undefined) {
        asyncTestError.error = error ?? new Error("undefined error");
      } else {
        console.error("Multiple failed fetch expectations", error);
      }
    }
  );

  const configMockParams: CosmiconfigMockParams = {
    searchFrom: path.resolve(projectPath(params)),
    searchResult:
      params.config !== null
        ? {
            config: params.config,
            filepath: "MOCK_BASE/packages/cypress-plugin/test/unflakable.yml",
          }
        : null,
  };

  // We don't directly invoke `cypress-unflakable` because we need to pass `--require` to Node.JS
  // in order to mock cosmiconfig for testing. Instead, we resolve the binary to an absolute path
  // using `yarn bin` and then invoke node directly.
  const cypressPluginBin = (
    await promisify(execFile)("yarn", ["bin", "cypress-unflakable"], {
      cwd: projectPath(params),
      // yarn.CMD isn't executable without a shell on Windows.
      shell: process.platform === "win32",
    })
  ).stdout.trimEnd();

  Object.entries(params.testEnvVars).forEach(([key, value]) => {
    expect(
      value,
      `Environment variable ${key} must not contain commas or spaces`
    ).not.toMatch(/[ ,]/);
  });
  const testEnv = [
    ...(skipFailures ? ["SKIP_FAILURES=1"] : []),
    ...(skipFlake ? ["SKIP_FLAKE=1"] : []),
    ...(skipQuarantined ? ["SKIP_QUARANTINED=1"] : []),
    ...(skipBeforeHook ? ["SKIP_BEFORE_HOOK=1"] : []),
    ...(skipBeforeEachHook ? ["SKIP_BEFORE_EACH_HOOK=1"] : []),
    ...(skipAfterEachHook ? ["SKIP_AFTER_EACH_HOOK=1"] : []),
    ...(skipAfterHook ? ["SKIP_AFTER_HOOK=1"] : []),
    ...(hookAndTestErrors ? ["HOOK_AND_TEST_ERRORS=1"] : []),
    ...(multipleHookErrors ? ["MULTIPLE_HOOK_ERRORS=1"] : []),
    ...Object.entries(params.testEnvVars).map(
      ([key, value]) => `${key}=${value}`
    ),
  ].join(",");

  const args = [
    "--require",
    require.resolve("unflakable-test-common/dist/mock-cosmiconfig"),
    cypressPluginBin,
    ...(params.project === "integration-input-manual"
      ? ["--no-auto-config", "--no-auto-support"]
      : []),
    ...params.cliArgs,
    "--",
    // e2e/component
    `--${params.testMode}`,
    // Chrome is faster than Electron, at least on Mac. However, it's much slower on Windows.
    "--browser",
    process.platform === "win32" ? "edge" : "chrome",
    ...(params.specNameStubs !== undefined
      ? [
          "--spec",
          params.specNameStubs
            .map((stub) => specProjectPath(params, stub))
            .join(","),
        ]
      : []),
    ...(params.configFile !== "cypress.config.ts"
      ? ["--config-file", params.configFile]
      : []),
    ...(testEnv !== "" ? ["--env", testEnv] : []),
  ];

  const env = {
    ...params.envVars,
    DEBUG: process.env.TEST_DEBUG,
    // Ensure Cypress prints output with TTY colors.
    FORCE_COLOR: "1",
    // NODE_OPTIONS: "--loader=testdouble",
    // Needed for resolving `cypress-unflakable` path.
    PATH: process.env.PATH,
    UNFLAKABLE_API_BASE_URL: `http://localhost:${mockBackend.apiServerPort}`,
    [CONFIG_MOCK_ENV_VAR]: JSON.stringify(configMockParams),
    [GIT_MOCK_ENV_VAR]: JSON.stringify(params.git),
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
    projectPath(params),
    TEST_TIMEOUT_MS,
    async (stdoutLines) => {
      verifyOutput(
        params,
        stdoutLines,
        summaryTotals,
        mockBackend.apiServerPort
      );
      await mockBackend.checkExpectations(unmatchedRequestEndpoints);
    },
    expectedExitCode,
    false,
    asyncTestError
  );
};
