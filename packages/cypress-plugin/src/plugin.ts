// Copyright (c) 2023 Developer Innovations, LLC

import {
  createTestSuiteRun,
  TestAttemptResult,
  TestRunAttemptRecord,
  TestRunRecord,
  TestSuiteManifest,
  testSuiteRunUrl,
} from "@unflakable/js-api";
import path from "path";
import _debug from "debug";
import {
  autoDetectGit,
  branchOverride,
  commitOverride,
  isTestQuarantined,
  loadGitRepo,
  normalizeTestName,
  toPosix,
  UnflakableConfig,
  UnflakableConfigEnabled,
} from "@unflakable/plugins-common";
import { printWarning, require, userAgent } from "./utils";
import { configureMochaReporter } from "./reporter-config";
import {
  color,
  colorIf,
  displayRunStarting,
  displayScreenshots,
  displaySpecHeader,
  formatPath,
  formatSymbolSummary,
  getWidth,
  gray,
  Screenshot,
} from "./vendored/print-run";
import * as terminal from "./vendored/terminal";
import { HorizontalAlignment, HorizontalTableRow } from "cli-table3";
import * as humanTime from "./vendored/human_time";
import * as duration from "./vendored/duration";
import { aggregateRunStats, reporterStatsOrDefault } from "./reporter-common";
import { promisify } from "es6-promisify";
import { tmpName, TmpNameOptions } from "tmp";
import * as fs from "fs/promises";

const SKIP_TESTS_MODULE = "@unflakable/cypress-plugin/skip-tests";

const baseDebug = _debug("unflakable:plugin");

export type PluginOptions = {
  autoSupportFile?: boolean;
};

const cypressStateToResult = (
  state: string,
  isQuarantined: boolean
): TestAttemptResult | null => {
  switch (state) {
    case "failed":
      if (isQuarantined) {
        return "quarantined";
      } else {
        return "fail";
      }
    case "passed":
      return "pass";
    case "pending":
    case "skipped":
      return null;
    default:
      baseDebug(`Unexpected Cypress test state \`${state}\``);
      return null;
  }
};

const marshalAttempt = (
  attempt: CypressCommandLine.AttemptResult,
  isQuarantined: boolean
): TestRunAttemptRecord | null => {
  if (attempt.state === "pending" || attempt.state === "skipped") {
    // Test didn't execute.
    return null;
  }

  const result = cypressStateToResult(attempt.state, isQuarantined);
  if (result === null) {
    return null;
  }

  // NB: These types are broken in 12.17+ due to https://github.com/cypress-io/cypress/issues/27390.
  return {
    start_time: new Date(attempt.startedAt).toISOString(),
    // NB: there's no explicit end time for each attempt, Cypress does set the duration.
    duration_ms: attempt.duration,
    result,
  };
};

// Adapted from:
// https://github.com/cypress-io/cypress/blob/19e091d0bc2d1f4e6a6e62d2f81ea6a2f60d531a/packages/server/lib/util/print-run.ts#L397C15-L440
const displayResults = (
  spec: Cypress.Spec & {
    relativeToCommonRoot: string;
  },
  results: CypressCommandLine.RunResult
): void => {
  const reporterStats = reporterStatsOrDefault(results);

  const resultColor =
    reporterStats.failures +
      (reporterStats.unquarantinedFlakes ?? 0) +
      (reporterStats.unquarantinedSkipped ?? 0) >
    0
      ? "red"
      : "green";

  console.log("");

  terminal.header("Results", {
    color: [resultColor],
  });

  const numQuarantined =
    (reporterStats.quarantinedFailures ?? 0) +
    (reporterStats.quarantinedFlakes ?? 0) +
    (reporterStats.quarantinedPending ?? 0);

  const table = terminal.table({
    colWidths: [14, 86],
    type: "outsideBorder",
  });

  const screenshots = (results as { screenshots?: Screenshot[] }).screenshots;

  const data = (
    [
      // reporterStats.tests misses most pending tests because onTestEnd() isn't called for them.
      ["Tests:", results.stats.tests],
      ["Passing:", reporterStats.passes],
      ["Failing:", reporterStats.failures],
      (reporterStats.unquarantinedFlakes ?? 0) > 0
        ? ["Flaky:", reporterStats.unquarantinedFlakes]
        : undefined,
      numQuarantined > 0 ? ["Quarantined:", numQuarantined] : undefined,
      ["Pending:", reporterStats.unquarantinedPending ?? 0],
      [
        "Skipped:",
        (reporterStats.quarantinedSkipped ?? 0) +
          (reporterStats.unquarantinedSkipped ?? 0),
      ],
      ["Screenshots:", screenshots?.length ?? 0],
      ["Video:", Boolean(results.video)],
      ["Duration:", humanTime.long(results.stats.wallClockDuration ?? 0)],
      [
        "Spec Ran:",
        formatPath(spec.relativeToCommonRoot, getWidth(table, 1), resultColor),
      ],
    ] as (HorizontalTableRow | undefined)[]
  )
    .filter((row): row is HorizontalTableRow => row !== undefined)
    .map(([key, val]: HorizontalTableRow): HorizontalTableRow => {
      return [color(key, "gray"), color(val, resultColor)];
    });

  table.push(...data);

  console.log("");
  console.log(table.toString());
  console.log("");

  if ((screenshots?.length ?? 0) > 0) {
    displayScreenshots(screenshots);
  }
};

// Adapted from:
// https://github.com/cypress-io/cypress/blob/19e091d0bc2d1f4e6a6e62d2f81ea6a2f60d531a/packages/server/lib/util/print-run.ts#L70-L106
const formatFooterSummary = (
  results: CypressCommandLine.CypressRunResult
): string[] => {
  const runs = results.runs ?? [];

  const isCanceled = runs.some((run) => run.skippedSpec === true);

  const totals = aggregateRunStats(runs);

  // pass or fail color
  const c = isCanceled
    ? "magenta"
    : totals.failedOrFlakySpecs > 0
    ? "red"
    : "green";

  const phrase = ((): string => {
    if (isCanceled) {
      return "The run was canceled";
    }

    // if we have any specs failing...
    if (totals.failedOrFlakySpecs === 0) {
      return "All specs passed!";
    }

    // number of specs
    const total = runs.length;
    const percent = Math.round((totals.failedOrFlakySpecs / total) * 100);

    return `${totals.failedOrFlakySpecs} of ${total} failed (${percent}%)`;
  })();

  return [
    isCanceled ? "-" : formatSymbolSummary(totals.failedOrFlakySpecs),
    color(phrase, c),
    gray(duration.format(results.totalDuration)),
    colorIf(results.totalTests, "reset"),
    colorIf(totals.passedTests, "green"),
    colorIf(totals.failedTests, "red"),
    colorIf(totals.flakyTests, "yellow"),
    colorIf(totals.quarantinedTests + totals.quarantinedPending, "magenta"),
    colorIf(totals.unquarantinedPending, "cyan"),
    colorIf(totals.quarantinedSkipped + totals.unquarantinedSkipped, "blue"),
  ];
};

// Adapted from:
// https://github.com/cypress-io/cypress/blob/19e091d0bc2d1f4e6a6e62d2f81ea6a2f60d531a/packages/server/lib/util/print-run.ts#L299-L395
const renderSummaryTable = (
  results: CypressCommandLine.CypressRunResult
): void => {
  const runs = results.runs ?? [];

  console.log("");

  terminal.divider("=");

  console.log("");

  terminal.header("Run Finished", {
    color: ["reset"],
  });

  if (runs.length > 0) {
    const colAligns: HorizontalAlignment[] = [
      "left",
      "left",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
      "right",
    ];
    const colWidths = [3, 29, 11, 7, 9, 9, 7, 7, 9, 9];

    const table1 = terminal.table({
      colAligns,
      colWidths,
      type: "noBorder",
      head: [
        "",
        gray("Spec"),
        "",
        gray("Tests"),
        gray("Passing"),
        gray("Failing"),
        gray("Flaky"),
        gray("Quar."),
        gray("Pending"),
        gray("Skipped"),
      ],
    });

    const table2 = terminal.table({
      colAligns,
      colWidths,
      type: "border",
    });

    const table3 = terminal.table({
      colAligns,
      colWidths,
      type: "noBorder",
      head: formatFooterSummary(results),
    });

    runs.forEach((run): number => {
      const reporterStats = reporterStatsOrDefault(run);

      const ms = duration.format(run.stats.wallClockDuration ?? 0);

      const formattedSpec = formatPath(
        run.spec.relativeToCommonRoot,
        getWidth(table2, 1)
      );

      if (run.skippedSpec) {
        return table2.push([
          "-",
          formattedSpec,
          color("SKIPPED", "gray"),
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
          "-",
        ]);
      }

      return table2.push([
        formatSymbolSummary(
          Math.max(
            reporterStats.failures + (reporterStats.unquarantinedFlakes ?? 0),
            (reporterStats.unquarantinedSkipped ?? 0) > 0 ? 1 : 0
          )
        ),
        formattedSpec,
        color(ms, "gray"),
        colorIf(run.stats.tests, "reset"),
        colorIf(reporterStats.passes, "green"),
        colorIf(reporterStats.failures, "red"),
        colorIf(reporterStats.unquarantinedFlakes ?? 0, "yellow"),
        colorIf(
          (reporterStats.quarantinedFailures ?? 0) +
            (reporterStats.quarantinedFlakes ?? 0) +
            (reporterStats.quarantinedPending ?? 0),
          "magenta"
        ),
        colorIf(reporterStats.unquarantinedPending ?? 0, "cyan"),
        colorIf(
          (reporterStats.quarantinedSkipped ?? 0) +
            (reporterStats.unquarantinedSkipped ?? 0),
          "blue"
        ),
      ]);
    });

    console.log("");
    console.log("");
    console.log(terminal.renderTables(table1, table2, table3));
    console.log("");
  }
};

export class UnflakableCypressPlugin {
  private readonly apiKey: string;
  private readonly manifest: TestSuiteManifest | null;
  private readonly repoRoot: string;
  private readonly unflakableConfig: UnflakableConfig;

  private specs: Cypress.Spec[] | null = null;
  private specIndex = 0;
  private supportFilePath: string | null = null;

  constructor({
    apiKey,
    manifest,
    repoRoot,
    unflakableConfig,
  }: {
    apiKey: string;
    manifest: TestSuiteManifest | undefined;
    repoRoot: string;
    unflakableConfig: UnflakableConfig;
  }) {
    this.apiKey = apiKey;
    this.manifest = manifest ?? null;
    this.repoRoot = repoRoot;
    this.unflakableConfig = unflakableConfig;
  }

  public register = async (
    on: Cypress.PluginEvents,
    config: Cypress.PluginConfigOptions,
    options: PluginOptions
  ): Promise<Cypress.PluginConfigOptions> => {
    const debug = baseDebug.extend("register");

    if (!this.unflakableConfig.enabled) {
      debug("Unflakable plugin is disabled");
      return config;
    }

    configureMochaReporter(
      config,
      this.unflakableConfig,
      this.manifest ?? undefined,
      this.repoRoot
    );

    if (
      this.unflakableConfig.quarantineMode === "skip_tests" &&
      options.autoSupportFile !== false
    ) {
      const updatedSupportFile = await this.generateSkipTestsSupportFile(
        config
      );
      this.supportFilePath = updatedSupportFile;
      config.supportFile = updatedSupportFile;
    }

    on("before:run", this.onBeforeRun.bind(this));
    on("after:run", this.onAfterRun.bind(this));
    on("before:spec", this.onBeforeSpec.bind(this));
    on("after:spec", this.onAfterSpec.bind(this));

    config.retries = {
      runMode: this.unflakableConfig.failureRetries,
    };
    return config;
  };

  private generateSkipTestsSupportFile = async (
    config: Cypress.PluginConfigOptions
  ): Promise<string> => {
    const debug = baseDebug.extend("generateSkipTestsSupportFile");

    // We have to write a temporary Cypress support file on the fly because Cypress can't load
    // support files inside of node_modules. See https://github.com/cypress-io/cypress/issues/23616.
    // Once Cypress loads our support file, it's fine to load other modules that live in
    // node_modules. Cypress also requires the support file to be located within the project root
    // due to https://github.com/cypress-io/cypress/issues/8599#issuecomment-1290526416.
    const tmpdir = path.join(config.projectRoot, ".unflakable-tmp");
    await fs.mkdir(tmpdir, { recursive: true });

    const supportFilePath =
      (await promisify<string, TmpNameOptions>(tmpName)({
        prefix: "cypress-support-file",
        tmpdir,
      })) + ".cjs";
    debug(`Using temp path \`${supportFilePath}\` for Cypress support file`);

    const skipTestsPath = require.resolve(SKIP_TESTS_MODULE);
    debug(`Support file will load skip-tests from ${skipTestsPath}`);

    if (config.supportFile !== false) {
      debug(`Will load existing support file from ${config.supportFile}`);
    }

    const supportFileContents = `
require(${JSON.stringify(skipTestsPath)}).registerMochaInstrumentation();
${
  config.supportFile !== false
    ? `require(${JSON.stringify(config.supportFile)});`
    : ""
}
    `;

    await fs.writeFile(
      supportFilePath,
      Buffer.from(supportFileContents, "utf8"),
      {
        // Don't overwrite existing files.
        flag: "wx",
      }
    );

    return supportFilePath;
  };

  private uploadResults = async (
    results: CypressCommandLine.CypressRunResult,
    testRuns: TestRunRecord[]
  ): Promise<void> => {
    const debug = baseDebug.extend("uploadResults");

    debug("Reporting results to Unflakable");

    let branch = branchOverride.value,
      commit = commitOverride.value;

    if (
      this.unflakableConfig.gitAutoDetect &&
      (branch === undefined ||
        branch.length === 0 ||
        commit === undefined ||
        commit.length === 0)
    ) {
      const git = await loadGitRepo();
      if (git !== null) {
        const { branch: gitBranch, commit: gitCommit } = await autoDetectGit(
          git,
          console.error.bind(console)
        );

        if (branch === undefined || branch.length === 0) {
          branch = gitBranch;
        }
        if (commit === undefined || commit.length === 0) {
          commit = gitCommit;
        }
      }
    }

    const userAgentStr = userAgent(results.cypressVersion);

    debug("Reporting results to Unflakable");
    const testSuiteRun = await createTestSuiteRun({
      request: {
        branch,
        commit,
        start_time: new Date(results.startedTestsAt).toISOString(),
        end_time: new Date(results.endedTestsAt).toISOString(),
        test_runs: testRuns,
      },
      testSuiteId: (this.unflakableConfig as UnflakableConfigEnabled)
        .testSuiteId,
      apiKey: this.apiKey,
      baseUrl: this.unflakableConfig.apiBaseUrl,
      clientDescription: userAgentStr,
    }).catch((e) =>
      Promise.reject(
        new Error(`failed to report results to Unflakable: ${e as string}`)
      )
    );

    console.log(
      "Unflakable report: " +
        testSuiteRunUrl(
          testSuiteRun.suite_id,
          testSuiteRun.run_id,
          this.unflakableConfig.apiBaseUrl
        )
    );
  };

  private onBeforeRun = ({
    browser,
    config,
    group,
    parallel,
    runUrl,
    specPattern,
    specs,
    tag,
    autoCancelAfterFailures,
  }: Cypress.BeforeRunDetails & {
    // Added in Cypress 12.6: https://github.com/cypress-io/cypress/pull/25237.
    autoCancelAfterFailures?: number | false;
  }): void => {
    const debug = baseDebug.extend("beforeRun");
    debug("Received beforeRun event");

    this.specs = specs ?? [];
    displayRunStarting({
      // Some of these public types seem wrong since Cypress passes the same values to the
      // `before:run` event as it does to displayRunStarting():
      // https://github.com/cypress-io/cypress/blob/3d0a2b406115db292130df774348c4f1fd4a3240/packages/server/lib/modes/run.ts#L733-L806
      browser: browser as Cypress.Browser,
      config: config as Pick<Cypress.RuntimeConfigOptions, "version"> &
        Pick<
          Cypress.ResolvedConfigOptions,
          "resolvedNodeVersion" | "resolvedNodePath"
        >,
      group,
      parallel,
      runUrl,
      specPattern: specPattern as string[] | RegExp | string,
      specs: specs as CypressCommandLine.RunResult["spec"][],
      tag,
      autoCancelAfterFailures,
    });
  };

  private onAfterRun = async (
    results:
      | CypressCommandLine.CypressRunResult
      | CypressCommandLine.CypressFailedRunResult
  ): Promise<void> => {
    const debug = baseDebug.extend("afterRun");
    debug("Received afterRun event");

    if (this.supportFilePath !== null) {
      debug(`Deleting temp support file ${this.supportFilePath}`);
      await fs.unlink(this.supportFilePath).catch((e) => {
        printWarning(
          `Failed to delete temp support file ${
            this.supportFilePath as string
          }: ${e as string}`
        );
      });
    }

    if (results.status === "finished") {
      renderSummaryTable(results);

      const testRuns = results.runs.flatMap(({ spec, tests }) =>
        // Contrary to Cypress's TypeScript typing, tests can be `null` when the specs fail to
        // compile (e.g., due to Webpack errors).
        (tests ?? [])
          .map((test): TestRunRecord => {
            const filename = toPosix(
              path.relative(this.repoRoot, spec.absolute)
            );
            const isQuarantined =
              this.manifest !== null &&
              this.unflakableConfig.quarantineMode !== "no_quarantine" &&
              isTestQuarantined(this.manifest, filename, test.title);
            return {
              filename,
              name: normalizeTestName(test.title),
              attempts: test.attempts
                .map((attempt) => marshalAttempt(attempt, isQuarantined))
                .filter(
                  (attempt): attempt is TestRunAttemptRecord => attempt !== null
                ),
            };
          })
          .filter((test) => test.attempts.length > 0)
      );
      debug(`Test results: ${JSON.stringify(testRuns)}`);

      if (!this.unflakableConfig.uploadResults) {
        debug(
          "Not reporting results to Unflakable because configuration option `uploadResults` is false"
        );
      } else if (testRuns.length === 0) {
        debug("No results to report to Unflakable");
      } else {
        await this.uploadResults(results, testRuns);
      }
    }
  };

  private onBeforeSpec = (spec: Cypress.Spec): void => {
    const debug = baseDebug.extend("onBeforeSpec");
    debug(`Received onBeforeSpec event for spec ${spec.relative}`);

    displaySpecHeader(
      (
        spec as Cypress.Spec & {
          relativeToCommonRoot: string;
        }
      ).relativeToCommonRoot,
      ++this.specIndex,
      this.specs?.length ?? 0,
      // Spec duration estimates are a Cypress Cloud feature, and we don't have access to the API
      // response:
      // https://github.com/cypress-io/cypress/blob/2a17efac74111b0a723af0e5c186e73d18c688bd/packages/server/lib/modes/record.js#L674
      0
    );
  };

  private onAfterSpec = (
    spec: Cypress.Spec,
    results: CypressCommandLine.RunResult
  ): void => {
    const debug = baseDebug.extend("onAfterSpec");
    debug(
      `Received onAfterSpec event for spec ${spec.relative} with results %o`,
      results
    );

    // This can be set by Cypress Cloud.
    if (!results.skippedSpec) {
      displayResults(
        spec as Cypress.Spec & {
          relativeToCommonRoot: string;
        },
        results
      );
    }
  };
}
