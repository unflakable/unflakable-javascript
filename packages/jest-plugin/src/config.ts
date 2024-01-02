// Copyright (c) 2023-2024 Developer Innovations, LLC

import {
  IsFailureTestIndependentFn,
  UnflakableJestConfig,
  UnflakableJestConfigInner,
} from "./types";
import { loadConfigSync } from "@unflakable/plugins-common";
import util from "util";
import semverLt from "semver/functions/lt";
import jestPackage from "jest/package.json";

const parseIsFailureTestIndependent = (
  isFailureTestIndependent: unknown,
  filepath: string
): RegExp[] | IsFailureTestIndependentFn => {
  if (typeof isFailureTestIndependent === "function") {
    return isFailureTestIndependent as IsFailureTestIndependentFn;
  } else if (Array.isArray(isFailureTestIndependent)) {
    return isFailureTestIndependent.map((entry) => {
      if (typeof entry === "string") {
        try {
          return new RegExp(entry);
        } catch (e: unknown) {
          throw new Error(
            `Invalid \`__unstableIsFailureTestIndependent\` regex \`${util.format(
              entry
            )}\` found in ${filepath}: ${util.inspect(e)}`
          );
        }
      } else if (entry instanceof RegExp) {
        return entry;
      } else {
        throw new Error(
          `Unexpected \`__unstableIsFailureTestIndependent\` value \`${util.format(
            entry
          )}\` found in ${filepath}`
        );
      }
    });
  } else if (typeof isFailureTestIndependent === "string") {
    try {
      return [new RegExp(isFailureTestIndependent)];
    } catch (e: unknown) {
      throw new Error(
        `Invalid \`__unstableIsFailureTestIndependent\` regex \`${util.format(
          isFailureTestIndependent
        )}\` found in ${filepath}: ${util.inspect(e)}`
      );
    }
  } else if (isFailureTestIndependent instanceof RegExp) {
    return [isFailureTestIndependent];
  } else {
    throw new Error(
      `Unexpected \`__unstableIsFailureTestIndependent\` value \`${util.format(
        isFailureTestIndependent
      )}\` found in ${filepath}`
    );
  }
};

export const loadConfig = (searchFrom: string): UnflakableJestConfig =>
  loadConfigSync(
    searchFrom,
    (configResult): [UnflakableJestConfigInner, string[]] => {
      const config =
        configResult !== null && typeof configResult.config === "object"
          ? (configResult.config as { [s: string]: unknown })
          : null;
      if (
        configResult !== null &&
        config?.__unstableIsFailureTestIndependent !== undefined
      ) {
        if (semverLt(jestPackage.version, "28.0.0")) {
          throw new Error(
            "__unstableIsFailureTestIndependent requires Jest version 28+"
          );
        }
        return [
          {
            isFailureTestIndependent: parseIsFailureTestIndependent(
              config.__unstableIsFailureTestIndependent,
              configResult.filepath
            ),
          },
          ["__unstableIsFailureTestIndependent"],
        ];
      } else {
        return [{}, []];
      }
    }
  );
