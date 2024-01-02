// Copyright (c) 2023-2024 Developer Innovations, LLC

import { TextDecoder } from "util";
import treeKill from "tree-kill";
import _debug from "debug";
import { spawn } from "child_process";

const debug = _debug("unflakable:test-common:spawn");

// Async callbacks (e.g., mock API routes) can set this when an occurs during the test.
export type AsyncTestError = { error: unknown | undefined };

export const spawnTestWithTimeout = async (
  nodeArgs: string[],
  env: { [key in string]: string | undefined },
  cwd: string,
  timeout_ms: number,
  verifyOutput: (stdoutLines: string[], stderrLines: string[]) => Promise<void>,
  expectedExitCode: number,
  escapeStderrDebugOutput: boolean,
  asyncTestError: AsyncTestError
): Promise<void> => {
  debug(
    `Spawning test:\n  args = %o\n  environment = %o\n  cwd = %s`,
    nodeArgs,
    env,
    cwd
  );

  const child = spawn("node", nodeArgs, {
    cwd,
    env,
  });

  const onOutput = (
    name: string,
    onLine: (line: string, now: Date) => void,
    escapeDebugOutput: boolean
  ): ((data: Buffer) => void) => {
    const debugExt = debug.extend(name);
    const decoder = new TextDecoder("utf-8", { fatal: true });

    const pending = { s: "" };

    // Don't eat the last line of output.
    child.on("exit", () => {
      if (pending.s !== "") {
        onLine(pending.s, new Date());
        debugExt(escapeDebugOutput ? JSON.stringify(pending.s) : pending.s);
      }
    });

    return (data: Buffer): void => {
      const now = new Date();
      // In case data terminates in the middle of a Unicode sequence, we need to use a stateful
      // TextDecoder with `stream: true`. Otherwise, invalid UTF-8 sequences at the end get
      // converted to 0xFFFD, which breaks the tests non-deterministically (i.e., makes them flaky).
      const lines = decoder.decode(data, { stream: true }).split("\n");

      // If the last line is empty, then `dataStr` ends in a linebreak. Otherwise, we have a
      // partial line that we want to defer until the next call.
      lines.slice(0, lines.length - 1).forEach((line, idx) => {
        const lineWithPending = idx === 0 ? pending.s + line : line;
        onLine(lineWithPending, now);
        debugExt(
          escapeDebugOutput ? JSON.stringify(lineWithPending) : lineWithPending
        );
      });

      pending.s = lines[lines.length - 1];
    };
  };

  const stdoutLines = [] as string[];
  const stderrLines = [] as string[];
  const combinedLines = [] as string[];

  child.stderr.on(
    "data",
    onOutput(
      "stderr",
      (line, now) => {
        stderrLines.push(line);
        combinedLines.push(`${now.toISOString()} ${line}`);
      },
      // Don't escape stderr output since it likely comes from debug output in the subprocess, which
      // is intended for human consumption and not for verifying test results.
      escapeStderrDebugOutput
    )
  );
  child.stdout.on(
    "data",
    onOutput(
      "stdout",
      (line, now) => {
        stdoutLines.push(line);
        combinedLines.push(`${now.toISOString()} ${line}`);
      },
      // Escape special characters in debug output so that we can more easily understand test
      // failures related to unexpected output.
      true
    )
  );

  type ChildResult = {
    code: number | null;
    signal: NodeJS.Signals | null;
  };

  try {
    const { code, signal } = await new Promise<ChildResult>(
      (resolve, reject) => {
        const watchdog = setTimeout(() => {
          console.error(
            `Test timed out after ${timeout_ms}ms; killing child process tree`
          );
          const timeoutError = new Error(
            `Test timed out after ${timeout_ms}ms`
          );
          if (asyncTestError.error === undefined) {
            asyncTestError.error = timeoutError;
          }
          treeKill(child.pid, "SIGKILL", () => reject(timeoutError));
        }, timeout_ms);

        child.on("error", (err) => {
          clearTimeout(watchdog);
          reject(err);
        });
        child.on("exit", (code, signal) => {
          clearTimeout(watchdog);
          resolve({ code, signal });
        });
      }
    );

    if (asyncTestError.error !== undefined) {
      throw asyncTestError.error;
    }

    expect(signal).toBe(null);
    expect(code).toBe(expectedExitCode);

    await verifyOutput(stdoutLines, stderrLines);
  } catch (e: unknown) {
    // Jest doesn't have a built-in setting for printing console logs only for failed tests, so we
    // just defer the output until this catch block and attach it to the error. See
    // https://github.com/jestjs/jest/issues/4156. We don't call console.log() directly here because
    // that output gets printed before the failed test, whereas the error gets printed immediately
    // after, which makes it easy to associate with the corresponding test.
    throw new Error(`Test failed with output:\n\n${combinedLines.join("\n")}`, {
      cause: e,
    });
  }
};
