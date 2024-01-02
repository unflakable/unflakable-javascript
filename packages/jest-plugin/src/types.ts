// Copyright (c) 2022-2024 Developer Innovations, LLC

import type {
  AggregatedResult,
  AssertionResult,
  TestResult,
} from "@jest/test-result";
import {
  UnflakableConfig,
  UnflakableConfigEnabled,
} from "@unflakable/plugins-common";

export type IsFailureTestIndependentFn = (args: {
  failure: string;
  stderr: string;
  stdout: string;
  testFilePath: string;
  testName: string[];
}) => boolean | Promise<boolean>;

export type UnflakableJestConfigInner = {
  isFailureTestIndependent?: RegExp[] | IsFailureTestIndependentFn;
  __unstableIsFailureTestIndependent?: undefined;
};

export type UnflakableJestConfig = UnflakableConfig & UnflakableJestConfigInner;

export type UnflakableJestConfigEnabled = UnflakableConfigEnabled &
  UnflakableJestConfigInner;

export type UnflakableAssertionResult = AssertionResult & {
  _unflakableCapturedStderr?: string;
  _unflakableCapturedStdout?: string;
  _unflakableIsFailureTestIndependent?: boolean;
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
  // This represents a *subset* of numPassingTests and should not be added to it, or we'll be
  // double-counting passes.
  _unflakableNumPassingTestsWithIndependentFailures: number;
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

  // These represent *subsets* of numPassedTests/numPassedTestSuites and should not be added to
  // those values. Rather, they are intended to be consumed by the SummaryReporter to show which
  // tests/suites would have failed were it not for the failures being test-independent.
  _unflakableNumPassedTestsWithIndependentFailures: number;
  _unflakableNumPassedTestSuitesWithIndependentFailures: number;

  testResults: UnflakableTestResultWithCounts[];
};
