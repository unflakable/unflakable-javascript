// Copyright (c) 2023 Developer Innovations, LLC

import { runTestCase, TestCaseParams } from "./run-test-case";
import path from "path";
import cypressPackage from "cypress/package.json";
import { SummaryTotals } from "./parse-output";
import * as os from "os";
import * as util from "util";
import { MockBackend } from "unflakable-test-common/dist/mock-backend";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    // Public typing is wrong: done.fail() no longer exists.
    interface DoneCallback {
      (): void;

      (reason: Error | string): never;
    }
  }
}

export type TestCase = {
  params: Partial<TestCaseParams>;
  expectedExitCode?: number;
  summaryTotals?: SummaryTotals;
};

export const defaultExitCode = 8;
export const defaultSummaryTotals: SummaryTotals = {
  icon: "fail",
  numFailing: 6,
  numFlaky: 2,
  numPassing: 3,
  numPending: 5,
  numQuarantined: 3,
  numSkipped: 1,
  numTests: 20,
};

export const integrationTest = (
  testCase: TestCase,
  mockBackend: MockBackend,
  done: jest.DoneCallback
): void => {
  void runTestCase(
    {
      cliArgs: [],
      config: null,
      configFile: "cypress.config.ts",
      testEnvVars: {},
      expectedApiKey: "MOCK_API_KEY",
      expectedBranch: "MOCK_BRANCH",
      expectedCommit: "MOCK_COMMIT",
      expectedFlakeTestNameSuffix: "",
      expectedSuiteId: "MOCK_SUITE_ID",
      expectedRepoRelativePathPrefix: `test/${
        testCase.params.project ?? "integration-input"
      }/`,
      expectedRetries: 2,
      expectPluginToBeEnabled: true,
      expectResultsToBeUploaded: true,
      expectQuarantinedTestsToBeQuarantined: true,
      expectQuarantinedTestsToBeSkipped: false,
      failToFetchManifest: false,
      failToUploadResults: false,
      git: {
        abbreviatedRefs: {
          HEAD: "MOCK_BRANCH",
          "refs/heads/MOCK_BRANCH": "MOCK_BRANCH",
        },
        refs: [{ sha: "MOCK_COMMIT", refName: "refs/heads/MOCK_BRANCH" }],
        commit: "MOCK_COMMIT",
        isRepo: true,
        // Mock the git repo root as packages/cypress-plugin so that we're for sure testing the
        // mocked output and not using real git commands.
        repoRoot: path.resolve("../.."),
      },
      project: "integration-input",
      quarantineFlake: false,
      quarantineHookFail: false,
      quarantineHookSkip: false,
      skipFailures: false,
      skipFlake: false,
      skipQuarantined: false,

      skipBeforeHook: false,
      skipBeforeEachHook: true,
      skipAfterEachHook: true,
      skipAfterHook: true,
      hookAndTestErrors: false,
      multipleHookErrors: false,

      specNameStubs: undefined,
      testMode: "e2e",
      ...testCase.params,
      envVars: {
        UNFLAKABLE_API_KEY: "MOCK_API_KEY",
        UNFLAKABLE_SUITE_ID: "MOCK_SUITE_ID",
        ...testCase.params.envVars,
      },
    },
    testCase.expectedExitCode ?? defaultExitCode,
    testCase.summaryTotals ?? defaultSummaryTotals,
    mockBackend
  )
    .then(done)
    .catch((e) => {
      // Ensures any chained `cause` gets printed.
      done(util.inspect(e, { colors: true, depth: 5 }));
    });
};

export const integrationTestSuite = (
  runTests: (mockBackend: MockBackend) => void
): void => {
  const mockBackend = new MockBackend();

  beforeEach(() => mockBackend.start());
  afterEach(() => mockBackend.stop());

  const cypressMinorVersion = cypressPackage.version.match(/^[^.]+\.[^.]+/);
  const nodeMajorVersion = process.version.match(/^[^.]+/);

  describe(`Cypress ${
    cypressMinorVersion !== null
      ? cypressMinorVersion[0]
      : cypressPackage.version
  }`, () => {
    const platform = os.platform();
    describe(
      platform === "darwin"
        ? `MacOS`
        : platform === "linux"
        ? "Linux"
        : platform === "win32"
        ? "Windows"
        : platform,
      () => {
        // Only use Node major version for test name.
        describe(`Node ${
          nodeMajorVersion !== null ? nodeMajorVersion[0] : process.version
        }`, () => {
          runTests(mockBackend);
        });
      }
    );
  });
};
