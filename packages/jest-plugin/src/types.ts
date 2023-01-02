// Copyright (c) 2022-2023 Developer Innovations, LLC

import type {
  AggregatedResult,
  AssertionResult,
  TestResult,
} from "@jest/test-result";

export type QuarantineMode = "no_quarantine" | "skip_tests" | "ignore_failures";

export type UnflakableConfig = {
  apiBaseUrl: string | undefined;
  enabled: boolean;
  failureRetries: number;
  gitAutoDetect: boolean;
  quarantineMode: QuarantineMode;
  testSuiteId: string | undefined;
  uploadResults: boolean;
};

export type UnflakableAssertionResult = AssertionResult & {
  _unflakableIsQuarantined?: boolean;
};

export type UnflakableTestResult = TestResult & {
  _unflakableAttempt?: number;
  // Added by runner.
  _unflakableNumQuarantinedTests?: number;
  // Added by reporter.
  _unflakableNumFlakyTests?: number;
};

export type UnflakableAggregatedResult = Omit<
  AggregatedResult,
  "testResults"
> & {
  testResults: UnflakableTestResult[];
};
