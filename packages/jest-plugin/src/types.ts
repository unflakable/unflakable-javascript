// Copyright (c) 2022-2023 Developer Innovations, LLC

import type {
  AggregatedResult,
  AssertionResult,
  TestResult,
} from "@jest/test-result";

export type UnflakableAssertionResult = AssertionResult & {
  _unflakableIsQuarantined?: boolean;
};

export type UnflakableTestResult = Omit<TestResult, "testResults"> & {
  _unflakableAttempt?: number;
  testResults: UnflakableAssertionResult[];
};

// Counts added by reporter.
export type UnflakableTestResultWithCounts = UnflakableTestResult & {
  _unflakableNumQuarantinedTests: number;
  _unflakableNumFlakyTests: number;
};

export type UnflakableAggregatedResult = Omit<
  AggregatedResult,
  "testResults"
> & {
  testResults: UnflakableTestResult[];
};

export type UnflakableAggregatedResultWithCounts = Omit<
  AggregatedResult,
  "testResults"
> & {
  _unflakableNumFlakyTests: number;
  _unflakableNumQuarantinedTests: number;
  _unflakableNumQuarantinedSuites: number;

  testResults: UnflakableTestResultWithCounts[];
};
