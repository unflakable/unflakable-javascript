// Copyright (c) 2023-2024 Developer Innovations, LLC

import _debug from "debug";
import {
  getTestSuiteManifest as getTestSuiteManifestApi,
  TestSuiteManifest,
} from "@unflakable/js-api";
import chalk from "chalk";

const debug = _debug("unflakable:plugins-common:manifest");

export const getTestSuiteManifest = ({
  apiKey,
  baseUrl,
  clientDescription,
  log,
  testSuiteId,
}: {
  apiKey: string;
  baseUrl: string | undefined;
  clientDescription: string | undefined;
  log: (message: string) => void;
  testSuiteId: string;
}): Promise<TestSuiteManifest | undefined> =>
  getTestSuiteManifestApi({
    testSuiteId,
    apiKey,
    clientDescription,
    baseUrl,
  })
    .catch((e: Error) => {
      log(
        chalk.red(`ERROR: Failed to get Unflakable manifest: ${e.toString()}`) +
          "\n" +
          chalk.yellow.bold("Test failures will NOT be quarantined.") +
          "\n"
      );
      return undefined;
    })
    .then((manifest: TestSuiteManifest | undefined) => {
      debug(`Unflakable manifest: ${JSON.stringify(manifest)}`);
      return manifest;
    });
