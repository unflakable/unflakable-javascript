//#!/usr/bin/env node

// Copyright (c) 2023 Developer Innovations, LLC

import * as cypress from "cypress";
import _debug from "debug";
import {
  UnflakableConfig,
  branchOverride,
  commitOverride,
  loadConfig,
  QuarantineMode,
} from "@unflakable/plugins-common";
import path from "path";
import * as process from "process";
import chalk from "chalk";
import { aggregateRunStats } from "./reporter-common";
import { hideBin } from "yargs/helpers";
import yargs from "yargs";
import * as fs from "fs/promises";
import { require } from "./utils";
import {
  ENV_VAR_AUTO_SUPPORT,
  ENV_VAR_UNFLAKABLE_RESOLVED_CONFIG_JSON,
  ENV_VAR_USER_CONFIG_JSON,
  ENV_VAR_USER_CONFIG_PATH,
} from "./config-env-vars";

const CONFIG_WRAPPER_MODULE = "@unflakable/cypress-plugin/config-wrapper";

const debug = _debug("unflakable:main");

const exitDefault = (
  results: CypressCommandLine.CypressRunResult,
  unflakableConfig: UnflakableConfig
): never => {
  // Mirror's Cypress's behavior:
  // https://github.com/cypress-io/cypress/blob/0b10178850fc49bb3d590ca26ca50ae7c706f899/packages/server/lib/cypress.js#L267
  if (results.runs.length > 0) {
    // NB: This only arises when using the run cancellation feature of Cypress Cloud (see
    // https://docs.cypress.io/guides/cloud/runs#Run-cancellation and
    // https://github.com/cypress-io/cypress/pull/14925).
    const isCanceled = results.runs.filter((run) => run.skippedSpec).length > 0;
    if (isCanceled) {
      console.error(
        chalk.magenta(
          "\n  Exiting with non-zero exit code because the run was canceled."
        )
      );

      process.exit(1);
    }
  }

  if (!unflakableConfig.enabled) {
    process.exit(results.totalFailed);
  } else {
    const totals = aggregateRunStats(results.runs);

    debug(
      `${
        totals.failedTests + totals.flakyTests
      } total failure(s)/flake(s) after quarantining (originally ${
        totals.failedTests + totals.flakyTests + totals.quarantinedTests
      }) with${
        totals.unquarantinedSkipped > 0 ? "" : "out"
      } unquarantined skipped tests`
    );

    // Be sure to exit with non-zero if there are any non-quarantined skipped tests,
    // even if
    // all the failed/flaky tests are quarantined.
    process.exit(
      Math.max(
        totals.failedTests + totals.flakyTests,
        totals.unquarantinedSkipped > 0 ? 1 : 0
      )
    );
  }
};

// This only seems to arise if the cypress.run() API fails to parse the JSON output of the child
// Cypress process:
// https://github.com/cypress-io/cypress/blob/1d3aab9d70acbce6d3571ab5b9df771f1c455964/cli/lib/cypress.js#L45-L49
const exitFailure = (
  results: CypressCommandLine.CypressFailedRunResult
): never => {
  console.error(
    chalk.red(`\nCypress exited with error: ${chalk.magenta(results.message)}`)
  );

  // We always want to exit with a non-zero code in this case. If the child process already
  // exited with a non-zero code, propagate it through. For reference, Cypress sets the exit code
  // based on the number of failures and propagates it through in this case:
  // https://github.com/cypress-io/cypress/blob/0b10178850fc49bb3d590ca26ca50ae7c706f899/cli/lib/cypress.js#L41
  process.exit(results.failures !== 0 ? results.failures : 1);
};

const parseArgs = (
  argv: string[]
): yargs.Argv<{
  _: (string | number)[];
  "auto-config": boolean;
  "auto-support": boolean;
  branch?: string;
  commit?: string;
  "failure-retries"?: number;
  "git-auto-detect"?: boolean;
  "quarantine-mode"?: string;
  "test-suite-id"?: string;
  "upload-results"?: boolean;
}>["argv"] =>
  yargs(hideBin(argv))
    .scriptName("cypress-unflakable")
    .usage(
      "Unflakable plugin wrapper for `cypress run` command.\n\n" +
        "Usage: $0 [unflakable-options...] [-- <cypress-options...>]\n\n" +
        "All options after `--` are passed to `cypress run`.\n\n" +
        "For complete documentation, please visit https://docs.unflakable.com/plugins/cypress."
    )
    .example("$0", "Run all Cypress e2e tests")
    .example(
      "$0 -- --spec cypress/e2e/mytest.cy.ts",
      "Run a single Cypress e2e spec"
    )
    .example("$0 -- --component", "Run all Cypress component tests")
    .example(
      "$0 --test-suite-id <test suite ID>",
      "Specify Unflakable test suite ID as a command-line option"
    )
    .example(
      "$0 --test-suite-id <test suite ID> -- --spec cypress/e2e/mytest.cy.ts",
      "Combine Unflakable and Cypress options"
    )
    .option("auto-config", {
      description:
        "Automatically wrap the Cypress config file to run the Unflakable plugin",
      default: true,
      type: "boolean",
    })
    .option("auto-support", {
      description:
        "Automatically wrap the Cypress support file to skip tests when quarantineMode is `skip_tests`",
      default: true,
      type: "boolean",
    })
    .option("branch", {
      description:
        "Name of the version control (e.g., Git) branch containing the code being tested " +
        "(overrides branch name inferred from Git when the `gitAutoDetect` config option is " +
        "enabled)",
      type: "string",
    })
    .option("commit", {
      description:
        "Git commit hash or other value that uniquely identifies the commit (version control " +
        "revision) of the code being tested (overrides commit hash inferred from Git " +
        "when the `gitAutoDetect` config option is enabled)",
      type: "string",
    })
    .option("failure-retries", {
      description:
        "Maximum number of times to retry each failed test (overrides `failureRetries` config value)",
      type: "number",
    })
    .option("git-auto-detect", {
      description:
        "Auto-detect the current branch and commit hash from Git (overrides `gitAutoDetect` config value)",
      type: "boolean",
    })
    .option("quarantine-mode", {
      description:
        "Controls the behavior of quarantined tests (overrides `quarantineMode` config value)",
      choices: ["no_quarantine", "skip_tests", "ignore_failures"],
      type: "string",
    })
    .option("test-suite-id", {
      description:
        "Unflakable test suite ID (overrides `testSuiteId` config value)",
      type: "string",
    })
    .option("upload-results", {
      description:
        "Upload test results to Unflakable (overrides `uploadResults` config value)",
      // NB: we don't specify a default here because that would always override the value from the
      // config.
      type: "boolean",
    })
    // Reject unknown options. Unfortunately, there doesn't seem to be an easy way to capture
    // unknown options and treat them as position args in `argv._`. Instead, we'll just have to
    // require ` -- ` prior to any Cypress options.
    .strict()
    // Examples look bad when wrapped.
    .wrap(Math.min(process.stdout.columns, 160)).argv;

const POTENTIAL_CONFIG_FILES = [
  "cypress.config.ts",
  "cypress.config.mjs",
  "cypress.config.cjs",
  "cypress.config.js",
];

// Follow Cypress's config file resolution process. See:
// https://github.com/cypress-io/cypress/blob/62f58e00ec0e1f95bc0db3c644638e4882b91992/packages/data-context/src/data/ProjectLifecycleManager.ts#L659C9-L713
const resolveUserConfigPath = async (
  projectRoot: string,
  runOptions: Partial<CypressCommandLine.CypressRunOptions>
): Promise<string> => {
  if (runOptions.configFile !== undefined) {
    return path.join(projectRoot, runOptions.configFile);
  }

  for (const fileName of POTENTIAL_CONFIG_FILES) {
    const filePath = path.isAbsolute(fileName)
      ? fileName
      : path.join(projectRoot, fileName);
    if (
      await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false)
    ) {
      debug(`Found Cypress config file at ${filePath}`);
      return filePath;
    }
  }

  throw new Error(
    `Could not find a Cypress configuration file in folder ${projectRoot}`
  );
};

const findUserTsConfig = async (searchDir: string): Promise<string | null> => {
  try {
    const possibleTsConfigPath = path.join(searchDir, "tsconfig.json");
    await fs.stat(possibleTsConfigPath);
    // If fs.stat() doesn't throw an exception, the file exists.
    debug(`Found tsconfig.json at ${possibleTsConfigPath}`);
    return possibleTsConfigPath;
  } catch {
    const parent = path.dirname(searchDir);
    if (parent !== searchDir) {
      return findUserTsConfig(parent);
    } else {
      return null;
    }
  }
};

const main = async (): Promise<void> => {
  const args = await parseArgs(process.argv);

  const cypressArgs = [
    "run",
    // In case yargs parsed an option as a number, we need all of the args to be strings.
    ...args._.map((arg) => arg.toString()),
  ];
  debug(`Parsing Cypress args ${JSON.stringify(cypressArgs)}`);
  const runOptions = await cypress.cli.parseRunArguments(cypressArgs);

  const projectRoot =
    runOptions.project !== undefined
      ? path.resolve(process.cwd(), runOptions.project)
      : process.cwd();

  const unflakableConfig = await loadConfig(projectRoot, args["test-suite-id"]);
  debug(`Unflakable plugin is ${unflakableConfig.enabled ? "en" : "dis"}abled`);

  if (unflakableConfig.enabled) {
    if (args.branch !== undefined) {
      branchOverride.value = args.branch;
    }
    if (args.commit !== undefined) {
      commitOverride.value = args.commit;
    }

    if (args["failure-retries"] !== undefined) {
      unflakableConfig.failureRetries = args["failure-retries"];
    }
    if (args["git-auto-detect"] !== undefined) {
      unflakableConfig.gitAutoDetect = args["git-auto-detect"];
    }
    if (args["quarantine-mode"] !== undefined) {
      unflakableConfig.quarantineMode = args[
        "quarantine-mode"
      ] as QuarantineMode;
    }
    if (args["upload-results"] !== undefined) {
      unflakableConfig.uploadResults = args["upload-results"];
    }

    ENV_VAR_UNFLAKABLE_RESOLVED_CONFIG_JSON.value =
      JSON.stringify(unflakableConfig);

    if (args["auto-config"]) {
      if (runOptions.config !== undefined) {
        ENV_VAR_USER_CONFIG_JSON.value = JSON.stringify(runOptions.config);
      } else {
        const userConfigPath = await resolveUserConfigPath(
          projectRoot,
          runOptions
        );
        ENV_VAR_USER_CONFIG_PATH.value = userConfigPath;

        // By default, Cypress invokes ts-node on CommonJS TypeScript projects by setting `dir`
        // (deprecated alias for `cwd`) to the directory containing the Cypress config file:
        // https://github.com/cypress-io/cypress/blob/62f58e00ec0e1f95bc0db3c644638e4882b91992/packages/server/lib/plugins/child/ts_node.js#L63

        // For both ESM and CommonJS TypeScript projects, Cypress invokes ts-node with the CWD set
        // to that directory:
        // https://github.com/cypress-io/cypress/blob/62f58e00ec0e1f95bc0db3c644638e4882b91992/packages/data-context/src/data/ProjectConfigIpc.ts#L260

        // Since we're passing our `config-wrapper.js` as the Cypress config, the CWD becomes our
        // dist/ directory. However, we need ts-node to load the user's tsconfig.json, not our own,
        // or the user's cypress.config.ts file may not load properly when we require()/import()
        // it.
        // To accomplish this, we try to discover the user's tsconfig.json by traversing the
        // ancestor directories containing the user's Cypress config file. This is the same
        // approach TypeScript uses:
        // https://github.com/microsoft/TypeScript/blob/2beeb8b93143f75cdf788d05bb3678ce3ff0e2b3/src/compiler/program.ts#L340-L345

        // If we find a tsconfig.json, we set the TS_NODE_PROJECT environment variable to the
        // directory containing it, which ts-node then uses instead of searching the `dir` passed by
        // Cypress.
        const userTsConfig = await findUserTsConfig(
          path.dirname(userConfigPath)
        );
        if (userTsConfig !== null) {
          const tsNodeProject = path.dirname(userTsConfig);
          debug(`Setting TS_NODE_PROJECT to ${tsNodeProject}`);
          process.env.TS_NODE_PROJECT = tsNodeProject;
        }
      }
    }

    if (args["auto-support"] === false) {
      ENV_VAR_AUTO_SUPPORT.value = "false";
    }
  }

  const results = await cypress.run(
    unflakableConfig.enabled
      ? {
          ...runOptions,
          ...(args["auto-config"]
            ? {
                configFile: require.resolve(CONFIG_WRAPPER_MODULE),
              }
            : {}),
          quiet: true,
        }
      : runOptions
  );
  if (results.status === "finished") {
    exitDefault(results, unflakableConfig);
  } else {
    exitFailure(results);
  }
};

void main();
