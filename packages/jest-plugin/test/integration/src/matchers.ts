// Copyright (c) 2023 Developer Innovations, LLC

import {
  MatcherHintOptions,
  matcherErrorMessage,
  matcherHint,
  RECEIVED_COLOR,
  printWithType,
  printReceived,
  getLabelPrinter,
  printExpected,
  INVERTED_COLOR,
  stringify,
} from "jest-matcher-utils";
import type { SyncExpectationResult } from "expect";
import { equals, iterableEquality } from "@jest/expect-utils";
import * as getType from "jest-get-type";

function toContainEqualTimes(
  this: jest.MatcherContext,
  received: Array<unknown> | Set<unknown>,
  expected: unknown,
  times: number
): SyncExpectationResult {
  const matcherName = "toContainEqualTimes";
  const isNot = this.isNot;
  const options: MatcherHintOptions = {
    comment: "deep equality",
    isNot,
    promise: this.promise,
  };

  if (received === null) {
    throw new Error(
      matcherErrorMessage(
        matcherHint(matcherName, undefined, undefined, options),
        `${RECEIVED_COLOR("received")} value must not be null nor undefined`,
        printWithType("Received", received, printReceived)
      )
    );
  }

  const matchIndices = Array.from(received).reduce(
    (matchIndices: number[], item: unknown, index: number) =>
      equals(item, expected, [...(this.customTesters ?? []), iterableEquality])
        ? [...matchIndices, index]
        : matchIndices,
    []
  );

  const pass = matchIndices.length === times;

  const message = (): string => {
    const labelExpected = `Expected value ${times} time${
      times !== 1 ? "s" : ""
    }`;
    const labelReceived = `Received ${(getType.getType ?? getType)(
      received
    )} with ${matchIndices.length} match${
      matchIndices.length !== 1 ? "es" : ""
    }`;
    const printLabel = getLabelPrinter(labelExpected, labelReceived);

    return (
      matcherHint(matcherName, undefined, undefined, options) +
      "\n\n" +
      `${printLabel(labelExpected)}${
        isNot === true ? "not " : ""
      }${printExpected(expected)}\n` +
      `${printLabel(labelReceived)}${isNot === true ? "    " : ""}${
        isNot === true && Array.isArray(received)
          ? RECEIVED_COLOR(
              `[${received
                .map((item, i) => {
                  const stringified = stringify(item);
                  return matchIndices.includes(i)
                    ? INVERTED_COLOR(stringified)
                    : stringified;
                })
                .join(", ")}]`
            )
          : printReceived(received)
      }`
    );
  };

  return { message, pass };
}

expect.extend({
  toContainEqualTimes,
});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toContainEqualTimes(expected: unknown, times: number): R;
    }
  }
}
