// Copyright (c) 2023-2024 Developer Innovations, LLC

// jest-circus doesn't export the types for runner. See:
// https://github.com/jestjs/jest/blob/6d2632adae0f0fa1fe116d3b475fd9783d0de1b5/packages/jest-circus/runner.js#L10-L9
// https://github.com/jestjs/jest/blob/6d2632adae0f0fa1fe116d3b475fd9783d0de1b5/packages/jest-runner/src/types.ts#L34
declare module "jest-circus/runner" {
  import { Config } from "@jest/types";
  import { JestEnvironment } from "@jest/environment";
  import {
    TestResult,
    AssertionResult,
    SerializableError,
    Test,
  } from "@jest/test-result";

  // Exported by newer Jest versions but not older ones prior to 26.2.0.
  export declare type TestEvents = {
    "test-file-start": [Test];
    "test-file-success": [Test, TestResult];
    "test-file-failure": [Test, SerializableError];
    "test-case-result": [string, AssertionResult];
  };

  export declare type TestFileEvent<
    T extends keyof TestEvents = keyof TestEvents
  > = (eventName: T, args: TestEvents[T]) => unknown;

  export declare type UnsubscribeFn = () => void;

  export declare type TestFramework = (
    globalConfig: Config.GlobalConfig,
    config: Config.ProjectConfig,
    environment: JestEnvironment,
    runtime: unknown,
    testPath: string,
    sendMessageToJest?: TestFileEvent
  ) => Promise<TestResult>;

  const initialize: TestFramework;
  export default initialize;
}
