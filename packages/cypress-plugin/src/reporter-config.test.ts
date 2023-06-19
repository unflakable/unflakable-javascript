// Copyright (c) 2023 Developer Innovations, LLC

import { configureMochaReporter } from "./reporter-config";
import { QuarantineMode } from "@unflakable/plugins-common";
import { expect, it } from "@jest/globals";
import path from "path";
import { require } from "./utils";
import { promisify } from "es6-promisify";
import { tmpName, TmpNameOptions } from "tmp";
import * as fs from "fs/promises";

describe("configureMochaReporter", () => {
  const unflakableConfig = {
    apiBaseUrl: undefined,
    enabled: true,
    failureRetries: 2,
    gitAutoDetect: true,
    quarantineMode: "ignore_failures" as QuarantineMode,
    testSuiteId: "MOCK_SUITE_ID",
    uploadResults: true,
  };

  const cypressMultiReportersPath = path.join(
    "..",
    "..",
    "..",
    require.resolve("cypress-multi-reporters")
  );
  const projectRoot = "/foo/bar/baz";
  const repoRoot = "/foo/bar";
  const reporterRepoRelPath = "mock_node_modules/cypress-plugin/dist/reporter";
  const reporterAbsPath = path.join(repoRoot, reporterRepoRelPath);

  it.each(["", "spec"])('spec reporter w/ reporter="%s"', (reporter) => {
    const config = {
      projectRoot,
      reporter,
      reporterOptions: {},
    };

    configureMochaReporter(
      config,
      unflakableConfig,
      undefined,
      repoRoot,
      reporterAbsPath
    );

    expect(config).toStrictEqual({
      projectRoot,
      reporter: path.join("..", reporterRepoRelPath),
      reporterOptions: {
        config: unflakableConfig,
        manifest: undefined,
        projectRoot,
        repoRoot,
      },
    });
  });

  it.each([
    "@custom/reporter",
    "@custom/reporter, spec",
    ["@custom/reporter"],
    ["@custom/reporter", "spec"],
  ])(
    'cypress-multi-reporters w/ reporterEnabled="%s"',
    async (reporterEnabled) => {
      const cypressMultiReportersConfigPath =
        (await promisify<string, TmpNameOptions>(tmpName)({
          prefix: "unflakable-cypress-multi-reporters-config",
        })) + ".json";

      await fs.writeFile(
        cypressMultiReportersConfigPath,
        Buffer.from(
          JSON.stringify({
            reporterEnabled,
            customReporterReporterOptions: {
              foo: "bar",
            },
          }),
          "utf8"
        ),
        {
          // Don't overwrite existing files.
          flag: "wx",
        }
      );

      const config = {
        projectRoot,
        reporter: path.dirname(cypressMultiReportersPath),
        reporterOptions: {
          configFile: cypressMultiReportersConfigPath,
        },
      };

      configureMochaReporter(
        config,
        unflakableConfig,
        undefined,
        repoRoot,
        reporterAbsPath
      );

      expect(config).toStrictEqual({
        projectRoot,
        reporter: path.dirname(cypressMultiReportersPath),
        reporterOptions: {
          configFile: null,
          customReporterReporterOptions: {
            foo: "bar",
          },
          reporterEnabled: `@unflakable/cypress-plugin/reporter, @custom/reporter`,
          unflakableCypressPluginReporterReporterOptions: {
            config: unflakableConfig,
            manifest: undefined,
            projectRoot,
            repoRoot,
          },
        },
      });
    }
  );

  it("junit reporter", () => {
    const config = {
      projectRoot,
      reporter: "junit",
      reporterOptions: {},
    };

    configureMochaReporter(
      config,
      unflakableConfig,
      undefined,
      repoRoot,
      reporterAbsPath
    );

    expect(config).toStrictEqual({
      projectRoot,
      reporter: cypressMultiReportersPath,
      reporterOptions: {
        mochaJunitReporterReporterOptions: {},
        reporterEnabled: `@unflakable/cypress-plugin/reporter, mocha-junit-reporter`,
        unflakableCypressPluginReporterReporterOptions: {
          config: unflakableConfig,
          manifest: undefined,
          projectRoot,
          repoRoot,
        },
      },
    });
  });

  it("tap reporter", () => {
    const config = {
      projectRoot,
      reporter: "tap",
      reporterOptions: {
        tapVersion: "12",
      },
    };

    configureMochaReporter(
      config,
      unflakableConfig,
      undefined,
      repoRoot,
      reporterAbsPath
    );

    expect(config).toStrictEqual({
      projectRoot,
      reporter: cypressMultiReportersPath,
      reporterOptions: {
        tapReporterOptions: {
          tapVersion: "12",
        },
        reporterEnabled: `@unflakable/cypress-plugin/reporter, tap`,
        unflakableCypressPluginReporterReporterOptions: {
          config: unflakableConfig,
          manifest: undefined,
          projectRoot,
          repoRoot,
        },
      },
    });
  });

  it("custom reporter", () => {
    const config = {
      projectRoot,
      reporter: "custom",
      reporterOptions: {
        foo: "bar",
      },
    };

    configureMochaReporter(
      config,
      unflakableConfig,
      undefined,
      repoRoot,
      reporterAbsPath
    );

    expect(config).toStrictEqual({
      projectRoot,
      reporter: cypressMultiReportersPath,
      reporterOptions: {
        fooBarBazCustomReporterOptions: {
          foo: "bar",
        },
        // Absolute path to custom.
        reporterEnabled: `@unflakable/cypress-plugin/reporter, ${path.join(
          projectRoot,
          "custom"
        )}`,
        unflakableCypressPluginReporterReporterOptions: {
          config: unflakableConfig,
          manifest: undefined,
          projectRoot,
          repoRoot,
        },
      },
    });
  });
});
