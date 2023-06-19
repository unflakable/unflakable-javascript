// Copyright (c) 2023 Developer Innovations, LLC

import { expect } from "@jest/globals";
import type { MatcherFunction } from "expect";

const toBeAnInteger: MatcherFunction =
  // `floor` and `ceiling` get types from the line above
  // it is recommended to type them as `unknown` and to validate the values
  function (actual: unknown) {
    if (typeof actual !== "number") {
      return {
        message: () =>
          `expected ${this.utils.printReceived(actual)} to be number`,
        pass: false,
      };
    } else if (Number.isInteger(actual)) {
      return {
        message: () =>
          `expected ${this.utils.printReceived(actual)} not to be an integer`,
        pass: true,
      };
    } else {
      return {
        message: () =>
          `expected ${this.utils.printReceived(actual)} to be an integer`,
        pass: false,
      };
    }
  };

expect.extend({
  toBeAnInteger,
});

declare module "expect" {
  interface AsymmetricMatchers {
    // The @jest/global definitions return AsymmetricMatcher_2 here, but we use these in places
    // the expect arrays/strings.
    arrayContaining<T>(sample: Array<T>): T[];

    stringContaining(sample: string): string;

    stringMatching(sample: string | RegExp): string;

    // This doesn't actually return a number, but places that use it are places where we expect
    // numbers and would otherwise need an explicit cast.
    toBeAnInteger(): number;
  }

  interface Matchers<R> {
    toBeAnInteger(): R;
  }
}
