// Copyright (c) 2023 Developer Innovations, LLC

import _debug from "debug";
import {
  UnflakableConfig,
  setCosmiconfig,
  setCosmiconfigSync,
} from "@unflakable/plugins-common";
import {
  cosmiconfig,
  cosmiconfigSync,
  Options,
  OptionsSync,
} from "cosmiconfig";
import { default as expect } from "expect";

const debug = _debug("unflakable:test-common:config");

const throwUnimplemented = (): never => {
  throw new Error("unimplemented");
};

export type CosmiconfigMockParams = {
  expectedSearchFrom: string;
} & (
  | { pathToLoad: string; searchResult?: undefined }
  | {
      pathToLoad?: undefined;
      searchResult: {
        config: Partial<UnflakableConfig>;
        filepath: string;
      } | null;
    }
);

export const CONFIG_MOCK_ENV_VAR = "__UNFLAKABLE_TEST_CONFIG_MOCK_PARAMS";

export const registerCosmiconfigMock = (): void => {
  if (process.env[CONFIG_MOCK_ENV_VAR] === undefined) {
    debug(
      `Not mocking cosmiconfig since ${CONFIG_MOCK_ENV_VAR} environment variable is not set`
    );
    return;
  }

  const params = JSON.parse(
    process.env[CONFIG_MOCK_ENV_VAR]
  ) as CosmiconfigMockParams;

  debug("Mocking cosmiconfig with params %o", params);

  setCosmiconfig(
    (moduleName: string, options?: Options): ReturnType<typeof cosmiconfig> => {
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
        ): ReturnType<ReturnType<typeof cosmiconfig>["search"]> => {
          expect(searchFrom).toBe(params.expectedSearchFrom);
          if (params.pathToLoad !== undefined) {
            return cosmiconfig(moduleName, options).load(params.pathToLoad);
          } else {
            return Promise.resolve(params.searchResult);
          }
        },
      };
    }
  );

  setCosmiconfigSync(
    (
      moduleName: string,
      options?: OptionsSync
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
          expect(searchFrom).toBe(params.expectedSearchFrom);
          if (params.pathToLoad !== undefined) {
            return cosmiconfigSync(moduleName, options).load(params.pathToLoad);
          } else {
            return params.searchResult;
          }
        },
      };
    }
  );
};
