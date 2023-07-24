// Copyright (c) 2023 Developer Innovations, LLC

import { TestEvents, TestFileEvent, TestResult } from "@jest/test-result";
import { JestEnvironment } from "@jest/environment";
import { Config } from "@jest/types";
import Runtime from "jest-runtime";
import circus from "jest-circus/runner";
import { debug as _debug } from "debug";
import util from "util";
import { UnflakableAssertionResult } from "./types";

const baseStderrWrite = process.stderr.write.bind(process.stderr);
const baseStdoutWrite = process.stdout.write.bind(process.stdout);

const debug = _debug("unflakable:test-runner");
// Don't capture our own debug output as test output.
debug.log = (...args: unknown[]): boolean =>
  baseStderrWrite(util.format(...args) + "\n");

const write =
  (base: NodeJS.WriteStream["write"], capture: (buf: string) => void) =>
  (
    buffer: Uint8Array | string,
    encodingOrCb?: BufferEncoding | ((err?: Error) => void),
    cb?: (err?: Error) => void
  ): boolean => {
    capture(
      typeof buffer === "string"
        ? buffer
        : typeof encodingOrCb === "string"
        ? new util.TextDecoder(encodingOrCb).decode(buffer)
        : buffer.toString()
    );
    return base(buffer, encodingOrCb as BufferEncoding | undefined, cb);
  };

export default (
  globalConfig: Config.GlobalConfig,
  config: Config.ProjectConfig,
  environment: JestEnvironment,
  runtime: Runtime,
  testPath: string,
  sendMessageToJest?: TestFileEvent
): Promise<TestResult> => {
  debug(`initialize pid=${process.pid} testPath=\`${testPath}\``);

  let capturedStderr = "";
  let capturedStdout = "";

  process.stderr.write = write(
    baseStderrWrite,
    (buf) => (capturedStderr += buf)
  );
  process.stdout.write = write(
    baseStdoutWrite,
    (buf) => (capturedStdout += buf)
  );

  // TODO: Support other test runners?
  return circus(
    globalConfig,
    config,
    environment,
    runtime,
    testPath,
    sendMessageToJest !== undefined
      ? <T extends keyof TestEvents = keyof TestEvents>(
          eventName: T,
          args: TestEvents[T]
        ): unknown => {
          debug(
            `sendMessageToJest pid=${process.pid} testPath=\`${testPath}\` eventName=\`${eventName}\``
          );

          if (eventName === "test-case-result") {
            const result = args[1] as UnflakableAssertionResult;
            result._unflakableCapturedStderr = capturedStderr;
            result._unflakableCapturedStdout = capturedStdout;
            capturedStdout = "";
            capturedStderr = "";
          }

          return sendMessageToJest(eventName, args);
        }
      : undefined
  );
};
