// Copyright (c) 2022 Developer Innovations, LLC

import mockFetchJest from "fetch-mock-jest";
import { ResultCounts, runTestCase, TestCaseParams } from "./runTestCase";
import * as cosmiconfig from "cosmiconfig";
import type { OptionsSync } from "cosmiconfig";
import { FetchMockSandbox, MockCall } from "fetch-mock";
import jestPackage from "jest/package.json";

const throwUnimplemented = () => {
  throw new Error("unimplemented");
};

// Mocking `fs` is brittle, and making actual filesystem modifications to, e.g., package.json, can
// leave around artifacts that produce hard-to-debug side effects. Instead, we directly mock
// the cosmiconfig package that the jest-plugin uses for reading its config and hope that it's
// being used correctly. We still test one case of the actual implementation through dogfooding.
const mockConfigExplorer: ReturnType<typeof cosmiconfig.cosmiconfigSync> = {
  clearCaches: jest.fn(throwUnimplemented),
  clearLoadCache: jest.fn(throwUnimplemented),
  clearSearchCache: jest.fn(throwUnimplemented),
  load: jest.fn(throwUnimplemented),
  search: jest.fn(throwUnimplemented),
};
const mockCosmiconfig: typeof cosmiconfig = {
  ...jest.requireActual("cosmiconfig"),
  cosmiconfigSync: jest.fn((moduleName: string, options?: OptionsSync) => {
    expect(moduleName).toBe("unflakable");
    expect(options?.searchPlaces).toContain("package.json");
    expect(options?.searchPlaces).toContain("unflakable.json");
    expect(options?.searchPlaces).toContain("unflakable.js");
    expect(options?.searchPlaces).toContain("unflakable.yaml");
    expect(options?.searchPlaces).toContain("unflakable.yml");
    return mockConfigExplorer;
  }),
};
jest.mock("cosmiconfig", () => mockCosmiconfig);

// Jest calls exit() (the `exit` NPM package, not process.exit directly) if our custom reporter or
// runners throw an exception. This in turn causes the whole test run to exit rather than reporting
// the specific test as a failure. Instead, we mock exit() to log a message and continue execution.
const mockExit = jest.fn();
jest.mock("exit", () => mockExit);

jest.mock("node-fetch", () => mockFetchJest.sandbox());

jest.mock("simple-git");
jest.setTimeout(30000);

const originalStderrWrite = process.stderr.write.bind(process.stderr);

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

export const integrationTest = async (testCase: TestCase): Promise<void> => {
  const mockFetch = jest.requireMock<
    jest.MockInstance<Response, MockCall> & FetchMockSandbox
  >("node-fetch");
  await runTestCase(
    {
      config: null,
      expectedApiKey: "MOCK_API_KEY",
      expectedBranch: "MOCK_BRANCH",
      expectedCommit: "MOCK_COMMIT",
      expectedFailureRetries: 2,
      expectedFlakeTestNameSuffix: "",
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
    mockConfigExplorer,
    mockExit,
    mockFetch
  );
};

export const integrationTestSuite = (runTests: () => void) => {
  beforeEach(() => {
    (mockConfigExplorer.search as jest.Mock).mockClear();
    mockExit.mockClear();

    const mockFetch = jest.requireMock<FetchMockSandbox>("node-fetch");
    mockFetch.reset();

    // Don't propagate environment variables from the calling environment to the underlying tests,
    // which can lead to different results across environments and leak state between tests that
    // manipulate the environment.
    process.env = {
      NODE_ENV: "test",
    };

    let elapsedMs = 0;
    Date.now = jest.fn(() => {
      const date =
        new Date(Date.UTC(2022, 0, 23, 4, 5, 6, 789)).valueOf() + elapsedMs;
      elapsedMs += 200;
      return date;
    });

    // Restore original.
    process.stderr.write = originalStderrWrite;
  });

  describe(`Jest ${jestPackage.version}`, () => {
    describe(`Node ${process.version}`, () => {
      runTests();
    });
  });
};
