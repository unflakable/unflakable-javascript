// Copyright (c) 2022-2023 Developer Innovations, LLC

import type {
  AggregatedResult,
  AssertionResult,
  TestResult,
} from "@jest/test-result";

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
