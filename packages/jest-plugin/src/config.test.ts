// Copyright (c) 2023 Developer Innovations, LLC

import { loadConfig } from "./config";
import { cosmiconfigSync, Options } from "cosmiconfig";
import {
  setCosmiconfigSync,
  UnflakableConfigFile,
} from "@unflakable/plugins-common";
import { IsFailureTestIndependentFn } from "./types";

const MOCK_SUITE_ID = "MOCK_SUITE_ID";
const SEARCH_FROM = ".";

const throwUnimplemented = (): never => {
  throw new Error("unimplemented");
};

const setMockConfig = (
  config: Partial<
    UnflakableConfigFile & {
      __unstableIsFailureTestIndependent:
        | string
        | RegExp
        | (string | RegExp)[]
        | IsFailureTestIndependentFn;
    }
  >
): void => {
  setCosmiconfigSync(
    (
      moduleName: string,
      options?: Options
    ): ReturnType<typeof cosmiconfigSync> => {
      expect(moduleName).toBe("unflakable");
      expect(options?.searchPlaces).toContain("package.json");
      expect(options?.searchPlaces).toContain("unflakable.json");
      expect(options?.searchPlaces).toContain("unflakable.js");
      expect(options?.searchPlaces).toContain("unflakable.yaml");
      expect(options?.searchPlaces).toContain("unflakable.yml");
      return {
        clearCaches: throwUnimplemented,
        clearLoadCache: throwUnimplemented,
        clearSearchCache: throwUnimplemented,
        load: throwUnimplemented,
        search: (
          searchFrom?: string
        ): ReturnType<ReturnType<typeof cosmiconfigSync>["search"]> => {
          expect(searchFrom).toBe(SEARCH_FROM);
          return {
            config,
            filepath: "unflakable.js",
            isEmpty: false,
          };
        },
      };
    }
  );
};

describe("__unstableIsFailureTestIndependent", () => {
  it("should default to undefined", () => {
    setMockConfig({ testSuiteId: MOCK_SUITE_ID });
    const config = loadConfig(SEARCH_FROM);
    expect(config.testSuiteId).toBe(MOCK_SUITE_ID);
    expect(config.isFailureTestIndependent).toBeUndefined();
  });

  it("should accept a string regex", () => {
    setMockConfig({
      testSuiteId: MOCK_SUITE_ID,
      __unstableIsFailureTestIndependent: ".*",
    });
    const config = loadConfig(SEARCH_FROM);
    expect(config.testSuiteId).toBe(MOCK_SUITE_ID);
    expect(Array.isArray(config.isFailureTestIndependent)).toBe(true);
    expect(config.isFailureTestIndependent).toHaveLength(1);
    expect((config.isFailureTestIndependent as RegExp[])[0]).toBeInstanceOf(
      RegExp
    );
    expect((config.isFailureTestIndependent as RegExp[])[0].source).toBe(".*");
    expect((config.isFailureTestIndependent as RegExp[])[0].flags).toBe("");
  });

  it("should accept a RegExp object", () => {
    setMockConfig({
      testSuiteId: MOCK_SUITE_ID,
      __unstableIsFailureTestIndependent: /.*/gs,
    });
    const config = loadConfig(SEARCH_FROM);
    expect(config.testSuiteId).toBe(MOCK_SUITE_ID);
    expect(Array.isArray(config.isFailureTestIndependent)).toBe(true);
    expect(config.isFailureTestIndependent).toHaveLength(1);
    expect((config.isFailureTestIndependent as RegExp[])[0]).toBeInstanceOf(
      RegExp
    );
    expect((config.isFailureTestIndependent as RegExp[])[0].source).toBe(".*");
    expect((config.isFailureTestIndependent as RegExp[])[0].flags).toBe("gs");
  });

  it("should accept an array of strings/RegExps object", () => {
    setMockConfig({
      testSuiteId: MOCK_SUITE_ID,
      __unstableIsFailureTestIndependent: [/foo/s, /bar/g, "baz", ".*"],
    });
    const config = loadConfig(SEARCH_FROM);
    expect(config.testSuiteId).toBe(MOCK_SUITE_ID);
    expect(Array.isArray(config.isFailureTestIndependent)).toBe(true);
    expect(config.isFailureTestIndependent).toHaveLength(4);
    expect((config.isFailureTestIndependent as RegExp[])[0]).toBeInstanceOf(
      RegExp
    );
    expect((config.isFailureTestIndependent as RegExp[])[0].source).toBe("foo");
    expect((config.isFailureTestIndependent as RegExp[])[0].flags).toBe("s");
    expect((config.isFailureTestIndependent as RegExp[])[1]).toBeInstanceOf(
      RegExp
    );
    expect((config.isFailureTestIndependent as RegExp[])[1].source).toBe("bar");
    expect((config.isFailureTestIndependent as RegExp[])[1].flags).toBe("g");
    expect((config.isFailureTestIndependent as RegExp[])[2]).toBeInstanceOf(
      RegExp
    );
    expect((config.isFailureTestIndependent as RegExp[])[2].source).toBe("baz");
    expect((config.isFailureTestIndependent as RegExp[])[2].flags).toBe("");
    expect((config.isFailureTestIndependent as RegExp[])[3]).toBeInstanceOf(
      RegExp
    );
    expect((config.isFailureTestIndependent as RegExp[])[3].source).toBe(".*");
    expect((config.isFailureTestIndependent as RegExp[])[3].flags).toBe("");
  });
});
