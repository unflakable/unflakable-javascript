// Copyright (c) 2023 Developer Innovations, LLC

import jestPackage from "jest/package.json";
import path from "path";
import { ResultCounts, runTestCase, TestCaseParams } from "./run-test-case";
import { MockBackend } from "unflakable-test-common/dist/mock-backend";
import * as os from "os";
import * as util from "util";

export type TestCase = {
  params: Partial<TestCaseParams>;
  expectedExitCode: number;
  expectedResults: ResultCounts;
};

export const defaultExpectedResults: ResultCounts = {
  failedSuites: 4,
  failedTests: 2,
  flakyTests: 2,
  passedSuites: 1,
  passedTests: 2,
  quarantinedSuites: 1,
  quarantinedTests: 2,
  skippedSuites: 0,
  skippedTests: 0,
  passedSnapshots: 1,
  failedSnapshots: 0,
  totalSnapshots: 1,
};

export const integrationTest = (
  testCase: TestCase,
  mockBackend: MockBackend,
  done: jest.DoneCallback
): void => {
  void runTestCase(
    {
      config: null,
      expectedApiKey: "MOCK_API_KEY",
      expectedBranch: "MOCK_BRANCH",
      expectedCommit: "MOCK_COMMIT",
      expectedFailureRetries: 2,
      expectedFlakeTestNameSuffix: "",
      expectedRepoRelativePathPrefix: "test/integration-input/",
      expectedSuiteId: "MOCK_SUITE_ID",
      expectPluginToBeEnabled: true,
      expectResultsToBeUploaded: true,
      expectQuarantinedTestsToBeQuarantined: true,
      expectQuarantinedTestsToBeSkipped: false,
      expectSnapshots: false,
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
        // Mock the git repo root as packages/jest-plugin so that we're for sure testing the
        // mocked output and not using real git commands.
        repoRoot: path.resolve("../.."),
      },
      quarantineFlake: false,
      skipFailures: false,
      skipFlake: false,
      skipQuarantined: false,
      testNamePattern: undefined,
      ...testCase.params,
      envVars: {
        UNFLAKABLE_API_KEY: "MOCK_API_KEY",
        UNFLAKABLE_SUITE_ID: "MOCK_SUITE_ID",
        ...testCase.params.envVars,
      },
    },
    testCase.expectedExitCode,
    testCase.expectedResults,
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

  const jestMinorVersion = jestPackage.version.match(/^[^.]+\.[^.]+/);
  const nodeMajorVersion = process.version.match(/^[^.]+/);

  describe(`Jest ${
    jestMinorVersion !== null ? jestMinorVersion[0] : jestPackage.version
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
