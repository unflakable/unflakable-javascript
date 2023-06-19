// Copyright (c) 2023 Developer Innovations, LLC

import {
  defaultSummaryTotals,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";
import { TEST_PROJECTS, TestMode, TestProjectName } from "./run-test-case";
import { QuarantineMode } from "@unflakable/plugins-common";
import { afterEach, beforeEach } from "@jest/globals";
import * as fs from "fs/promises";

integrationTestSuite(() => {
  Object.entries(TEST_PROJECTS).forEach(([projectName, project]) => {
    describe(
      projectName === "integration-input"
        ? "CommonJS"
        : projectName === "integration-input-esm"
        ? "ESM"
        : "CommonJS (manual)",
      () => {
        if (projectName === "integration-input-manual") {
          const xunitPath =
            "../integration-input-manual/cypress/results/xunit.xml";
          beforeEach(async () => {
            // Try to delete any existing xunit reporter output (which we use to test our handling
            // of cypress-multi-reporters), but ignore failures since the file likely doesn't
            // exist.
            await fs.unlink(xunitPath).catch(() => undefined);
          });

          afterEach(async () => {
            // If the test ran successfully, it should have produced the XML output file. If it
            // didn't, we didn't handle cypress-multi-reporters correctly, and we should fail the
            // test. Note that this may make the afterEach() hook fail in the even that the test
            // also fails, but that shouldn't cause any issues.
            await fs.unlink(xunitPath).catch((e) => {
              throw new Error(
                `Failed to delete ${xunitPath}; did cypress-multi-reporters work as expected?`,
                { cause: e }
              );
            });
          });
        }

        project.configFiles.forEach((configFile) => {
          describe(configFile, () => {
            (["component", "e2e"] as TestMode[]).forEach((testMode) => {
              describe(testMode, () => {
                it.each(["ignore_failures", "skip_tests"] as QuarantineMode[])(
                  "defaults w/ quarantineMode = %s",
                  (quarantineMode, done) =>
                    integrationTest(
                      {
                        params: {
                          config:
                            quarantineMode === "skip_tests"
                              ? {
                                  quarantineMode,
                                }
                              : null,
                          configFile,
                          project: projectName as TestProjectName,
                          testMode,
                          expectQuarantinedTestsToBeSkipped:
                            quarantineMode === "skip_tests",
                        },
                        summaryTotals:
                          quarantineMode === "skip_tests"
                            ? {
                                ...defaultSummaryTotals,
                                numPending: 4,
                                numQuarantined: 4,
                              }
                            : defaultSummaryTotals,
                      },
                      done
                    )
                );
              });
            });
          });
        });
      }
    );
  });
});
