// Copyright (c) 2023 Developer Innovations, LLC

import { ReporterConfig } from "./reporter";
import { printWarning, require } from "./utils";
import path from "path";
import { reporters } from "mocha";
import _debug from "debug";
import { TestSuiteManifest } from "@unflakable/js-api";
import { UnflakableConfig } from "@unflakable/plugins-common";
import _ from "lodash";
import chalk from "chalk";
import process from "process";

const debug = _debug("unflakable:reporterConfig");

const MOCHA_REPORTER_MODULE = "@unflakable/cypress-plugin/reporter";

// This uses lodash to mirror cypress-multi-reporters's resolution of reporter names to keys within
// config.reporterOptions. See:
// https://github.com/YOU54F/cypress-plugins/blob/8c559869f3cadc0599eadae980d73472580d2077/cypress-multi-reporters/lib/MultiReporters.js#L204
const cypressMultiReportersOptionsKey = (name: string): string =>
  _.camelCase(name) + "ReporterOptions";

// Loads the existing cypress-multi-reporters config so that we can add our reporter to it. See:
// https://github.com/YOU54F/cypress-plugins/blob/8c559869f3cadc0599eadae980d73472580d2077/cypress-multi-reporters/lib/MultiReporters.js#L140-L197
const loadMultiReportersConfig = (
  config: Pick<Cypress.PluginConfigOptions, "reporterOptions">
): { [key: string]: unknown } => {
  const multiReporterConfigFilePath = config.reporterOptions?.configFile as
    | string
    | undefined;

  if (multiReporterConfigFilePath === undefined) {
    return config.reporterOptions ?? {};
  }

  try {
    const resolvedPath = path.resolve(multiReporterConfigFilePath);
    debug(
      `Loading cypress-multi-reporters config file ${multiReporterConfigFilePath} (resolved to ${resolvedPath})`
    );

    // We use require here to support both JSON and executable .js config files (as
    // cypress-multi-reporters does).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(resolvedPath) as {
      [key: string]: unknown;
    };
    debug(`Loaded cypress-multi-reporters config: %o`, config);

    if (config.configFile !== undefined && config.configFile !== null) {
      // Nested config files aren't supported by cypress-multi-reporters anyway, but if we leave
      // it set, the package will ignore the rest of our config.
      printWarning(
        `Ignoring nested cypress-multi-reporters \`configFile\` in config file ${
          config.configFile as string
        }`
      );
    }

    // We need to clear configFile or Cypress will merge the reporterOptions we return with the
    // original one and keep the configFile.
    config.configFile = null;

    // If there's a configFile, all the other reporterOptions get ignored.
    return config;
  } catch (e) {
    console.error(
      chalk.red(
        `Failed to load cypress-multi-reporters config from ${multiReporterConfigFilePath}: ${
          // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
          e
        }`
      )
    );
    process.exit(1);
  }
};

export const configureMochaReporter = (
  config: Pick<
    Cypress.PluginConfigOptions,
    "projectRoot" | "reporter" | "reporterOptions"
  >,
  unflakableConfig: UnflakableConfig,
  manifest: TestSuiteManifest | undefined,
  repoRoot: string,
  reporterAbsPath: string = require.resolve(MOCHA_REPORTER_MODULE)
): void => {
  // Cypress assumes that reporters are either (1) relative paths within the projectRoot or
  // (2) inside a node_modules directory in the projectRoot
  // (see https://github.com/cypress-io/cypress/issues/18922). As a workaround, we resolve the
  // path to the reporter using Node's module resolution, and then convert that path to one
  // that's relative to the projectRoot so that Cypress can find and load it.

  debug(`Configured reporter: ${config.reporter}`);
  debug(
    `Configured reporterOptions: ${JSON.stringify(config.reporterOptions)}`
  );

  const unflakableReporterConfig: ReporterConfig = {
    config: unflakableConfig,
    manifest,
    projectRoot: config.projectRoot,
    repoRoot,
  };

  // NB: If a reporter other than `spec` is being used, it's likely it won't handle retries
  // correctly and will only report the final attempt. This means flakes will probably be
  // considered passes by other reporters, and other reporters will of course not be aware of
  // quarantining. Still, we make our best effort to support other reporters being used, which
  // should report the expected results most of the time, when tests do not flake.
  if (["", "spec"].includes(config.reporter)) {
    if (
      // NB: typeof null is "object"
      typeof config.reporterOptions === "object" &&
      config.reporterOptions !== null &&
      Object.entries(config.reporterOptions).length > 0
    ) {
      printWarning(
        `Ignoring unsupported Mocha reporterOptions: ${JSON.stringify(
          config.reporterOptions
        )}`
      );
    }

    debug(`Absolute path to reporter: ${reporterAbsPath}`);

    const reporterRelPath = path.relative(config.projectRoot, reporterAbsPath);
    debug(`Project-relative path to reporter: ${reporterRelPath}`);

    config.reporter = reporterRelPath;
    config.reporterOptions = unflakableReporterConfig;
  } else if (/[\\/]?cypress-multi-reporters$/.test(config.reporter)) {
    // If cypress-multi-reporters is already being used, add our reporter to it and remove the
    // default spec reporter if it's being used.

    const cypressMultiReportersConfig = loadMultiReportersConfig(config);
    const nonSpecReporters = (
      Array.isArray(cypressMultiReportersConfig.reporterEnabled)
        ? (cypressMultiReportersConfig.reporterEnabled as string[])
        : typeof cypressMultiReportersConfig.reporterEnabled === "string"
        ? cypressMultiReportersConfig.reporterEnabled.split(",")
        : []
    )
      .map((reporter) => reporter.trim())
      .filter((reporter) => reporter !== "spec");

    config.reporterOptions = {
      ...cypressMultiReportersConfig,
      reporterEnabled: [MOCHA_REPORTER_MODULE, ...nonSpecReporters].join(", "),
      [cypressMultiReportersOptionsKey(MOCHA_REPORTER_MODULE)]:
        unflakableReporterConfig,
    };
  } else {
    // Cypress resolves reporters in a particular way:
    //  - "teamcity" (mocha-teamcity-reporter) and "junit" (mocha-junit-reporter) are
    // special-cased - Mocha's builtin reporters are passed through unmodified as string - others
    // are resolved relative to projectRoot; if that fails, they're resolved relative to
    // `${projectRoot}/node_modules` See:
    // https://github.com/cypress-io/cypress/blob/b0c0eaa508bb6dafdc1997bc00fb7ed6f5bcc160/packages/server/lib/reporter.js#L495-L548

    // Since we're introducing cypress-multi-reporters here, we need to convert the reporter
    // name/path from the representation Cypress expects to the one cypress-multi-reporters
    // expects. For built-in Mocha reporters, we don't need to do anything. For others, we need
    // to
    // convert them to a path supported by require(), which we do by simply passing the absolute
    // path to the module found relative to projectRoot or `${projectRoot}/node_modules`.
    // See:
    // https://github.com/YOU54F/cypress-plugins/blob/8c559869f3cadc0599eadae980d73472580d2077/cypress-multi-reporters/lib/MultiReporters.js#L66-L99

    // There's a special case for junit and teamcity, see:
    // https://github.com/cypress-io/cypress/blob/b0c0eaa508bb6dafdc1997bc00fb7ed6f5bcc160/packages/server/lib/reporter.js#L504-L511
    if (["junit", "teamcity"].includes(config.reporter)) {
      const reporterModule = `mocha-${config.reporter}-reporter`;
      debug(
        `Configured reporter \`${config.reporter}\` is a Cypress special case mapped to \`${reporterModule}\``
      );
      config.reporterOptions = {
        reporterEnabled: [MOCHA_REPORTER_MODULE, reporterModule].join(", "),
        [cypressMultiReportersOptionsKey(reporterModule)]:
          config.reporterOptions ?? {},
        [cypressMultiReportersOptionsKey(MOCHA_REPORTER_MODULE)]:
          unflakableReporterConfig,
      };
    } else if (Object.keys(reporters).includes(config.reporter)) {
      debug(`Configured reporter \`${config.reporter}\` is a Mocha reporter`);
      config.reporterOptions = {
        reporterEnabled: [MOCHA_REPORTER_MODULE, config.reporter].join(", "),
        [cypressMultiReportersOptionsKey(config.reporter)]:
          config.reporterOptions ?? {},
        [cypressMultiReportersOptionsKey(MOCHA_REPORTER_MODULE)]:
          unflakableReporterConfig,
      };
    } else {
      const userReporterAbsPath = path.join(
        config.projectRoot,
        config.reporter
      );
      debug(
        `Resolving reporter \`${config.reporter}\` to absolute path: ${userReporterAbsPath}`
      );

      config.reporterOptions = {
        reporterEnabled: [MOCHA_REPORTER_MODULE, userReporterAbsPath].join(
          ", "
        ),
        [cypressMultiReportersOptionsKey(userReporterAbsPath)]:
          config.reporterOptions ?? {},
        [cypressMultiReportersOptionsKey(MOCHA_REPORTER_MODULE)]:
          unflakableReporterConfig,
      };
    }

    const reporterAbsPath = require.resolve("cypress-multi-reporters");
    debug(`Absolute path to cypress-multi-reporters: ${reporterAbsPath}`);

    const reporterRelPath = path.relative(config.projectRoot, reporterAbsPath);
    debug(
      `Project-relative path to cypress-multi-reporters: ${reporterRelPath}`
    );
    config.reporter = reporterRelPath;
  }

  debug(`Updated reporter: ${config.reporter}`);
  debug(`Updated reporterOptions: ${JSON.stringify(config.reporterOptions)}`);
};
