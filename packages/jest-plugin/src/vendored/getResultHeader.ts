// Copyright (c) 2022-2023 Developer Innovations, LLC

import { utils } from "@jest/reporters";
import { TestResult } from "@jest/test-result";
import type { Config } from "@jest/types";

type getResultHeaderFn = (
  result: TestResult,
  globalConfig: Config.GlobalConfig,
  projectConfig?: Config.ProjectConfig | undefined
) => string;

// Jest 27+ exports utils.getResultHeader.
const exportedGetResultHeader = (
  utils as { getResultHeader?: getResultHeaderFn }
).getResultHeader;

let _getResultHeader: getResultHeaderFn;
if (exportedGetResultHeader !== undefined) {
  _getResultHeader = exportedGetResultHeader;
} else {
  try {
    // Jest 26.6.
    _getResultHeader = require("@jest/reporters/build/getResultHeader")
      .default as getResultHeaderFn;
  } catch (e) {
    // Jest < 26.6.
    _getResultHeader = require("@jest/reporters/build/get_result_header")
      .default as getResultHeaderFn;
  }
}

export const getResultHeader = _getResultHeader;
