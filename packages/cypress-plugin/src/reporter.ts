// Copyright (c) 2023 Developer Innovations, LLC

import _debug from "debug";
import {
  CypressTest,
  MochaOptions,
  Runner,
  reporters,
  Suite,
  utils as mochaUtils,
  MochaEventTest,
} from "mocha";
import { TestSuiteManifest } from "@unflakable/js-api";
import {
  isTestQuarantined,
  UnflakableConfig,
} from "@unflakable/plugins-common";
import path from "path";
import milliseconds from "ms";
import deepEqual from "deep-equal";
import { printWarning } from "./utils";
import { ReporterStats } from "./reporter-common";
import styles, { ForegroundColor } from "ansi-styles";

const debug = _debug("unflakable:reporter");

const useColors = reporters.Base.useColors;

export type ReporterConfig = {
  config: UnflakableConfig;
  manifest: TestSuiteManifest | undefined;
  projectRoot: string;
  repoRoot: string;
};

const currentTestRetry = (
  test: Omit<CypressTest | MochaEventTest, "err">
): number =>
  /* eslint-disable @typescript-eslint/ban-ts-comment */
  // @ts-ignore: currentRetry is protected, but we need to access it anyway...
  typeof test.currentRetry === "number"
    ? // @ts-ignore: see above.
      (test.currentRetry as unknown as number)
    : // @ts-ignore: see above.
    typeof test.currentRetry === "function"
    ? // @ts-ignore: see above.
      (test.currentRetry as () => number)()
    : /* eslint-enable @typescript-eslint/ban-ts-comment */
      0;

const testRetries = (test: Omit<CypressTest | MochaEventTest, "err">): number =>
  typeof test.retries === "number"
    ? (test.retries as unknown as number)
    : typeof test.retries === "function"
    ? test.retries()
    : 1;

const retryAttempt = (
  test: CypressTest | MochaEventTest,
  isRetry: boolean
): string => {
  const currentRetry = currentTestRetry(test);

  return isRetry || currentRetry > 0
    ? reporters.Base.color(
        "medium",
        ` (attempt ${currentRetry + 1} of ${testRetries(test) + 1})`
      )
    : "";
};

const testDepth = (test: CypressTest | Suite): number =>
  test.parent !== undefined ? 1 + testDepth(test.parent) : 0;

const stringifyDiffObjs = (err: Mocha.Error): void => {
  if (typeof err.actual !== "string" || typeof err.expected !== "string") {
    err.actual = mochaUtils.stringify(err.actual);
    err.expected = mochaUtils.stringify(err.expected);
  }
};

const mergeTestFailure = (
  src: { err?: Mocha.Error },
  dest: { err?: Mocha.Error }
): void => {
  if (
    src.err !== undefined &&
    // When the last retry fails, both onTestFail() and onTestEnd() get called even if there's only
    // one error, so we need to dedupe the errors here.
    !deepEqual(src.err, dest.err)
  ) {
    // We already recorded this test failure, but it has multiple exceptions, so we need to track
    // those.
    if (dest.err !== undefined) {
      dest.err.multiple = [
        src.err,
        ...(src.err.multiple ?? []),
        ...(dest.err.multiple ?? []),
      ];
    } else {
      dest.err = src.err;
    }
  }
};

// Returns true if a new test was added, or false if the test failure was merged with an existing
// test.
const pushOrMergeFailedTest = <T extends CypressTest | MochaEventTest>(
  failedTests: TestWithError<T>[],
  test: T & { hookName?: string }
): boolean => {
  const currentRetry = currentTestRetry(test);

  if (test.err !== undefined && test.hookName !== undefined) {
    const hookMsg = `"${test.hookName}" hook failed:\n`;
    if (test.err.message !== undefined) {
      // This is consumed by formatErrorMsgAndStack().
      if (test.err.stack !== undefined) {
        const indexIntoStackOrMsg = test.err.stack.indexOf(test.err.message);
        if (indexIntoStackOrMsg !== -1) {
          test.err.stack =
            test.err.stack.slice(0, indexIntoStackOrMsg) +
            hookMsg +
            test.err.stack.slice(indexIntoStackOrMsg);
        }
      }
      test.err.message = hookMsg + test.err.message;
    }
  }

  // NB: There's an edge case involving tests that have multiple errors. Ordinarily, onTestFail()
  // doesn't get called until the final retry fails. However, if multiple errors are thrown by
  // a single test (see https://github.com/mochajs/mocha/pull/4033), onTestFail() will get called
  // first, followed by onTestRetry() (if there will be subsequent attempts) or onTestEnd() (if
  // it's the final retry).
  const existingTestFailure = failedTests
    // This test will probably be the last one in this.retriedTests, but that may not be
    // guaranteed (especially if tests run in parallel) due to the async nature of Cypress.
    .find(
      (existingTestFailure) =>
        existingTestFailure.test.id === test.id &&
        currentTestRetry(existingTestFailure.test) === currentRetry
    );

  if (existingTestFailure === undefined) {
    // At this point, it's too early to determine whether the test is a flake or a failure, which
    // depends on whether any of the retries will pass.
    failedTests.push({ test, err: test.err });
    return true;
  } else {
    mergeTestFailure(test, existingTestFailure);
    return false;
  }
};

const formatFailedTestTitle = (titlePath: TestTitle): string =>
  titlePath.reduce(
    (testTitle: string, str: string, index: number) =>
      testTitle +
      (index > 0 ? "\n     " : "") +
      Array(index + 1).join("  ") +
      str,
    ""
  );

const formatErrorMsgAndStack = (err: Mocha.Error): [string, string] => {
  const messageRaw =
    err.message !== undefined && typeof err.message.toString === "function"
      ? String(err.message)
      : typeof err.inspect === "function"
      ? String(err.inspect())
      : "";
  const message = messageRaw !== "" ? messageRaw : "Error";

  const stackOrMsg = err.stack ?? message;

  const indexIntoStackOrMsg = stackOrMsg.indexOf(message);
  const msg =
    indexIntoStackOrMsg === -1
      ? message
      : stackOrMsg.slice(0, indexIntoStackOrMsg + message.length);
  const stack =
    indexIntoStackOrMsg === -1
      ? stackOrMsg
      : stackOrMsg.slice(indexIntoStackOrMsg + message.length + 1);

  if (reporters.Base.hideDiff !== true && reporters.Base.showDiff(err)) {
    stringifyDiffObjs(err);

    const match = message.match(/^([^:]+): expected/);
    return [
      (match !== null ? match[1] : msg) +
        reporters.Base.generateDiff(
          err.actual as string,
          err.expected as string
          // Un-indent to prevent duplicate indent since we do our own indenting of multi-line
          // error messages.
        ).replace(/^ {6}/gm, "  "),
      stack,
    ];
  } else {
    return [msg, stack];
  }
};

type FailedTestAttempt = {
  currentRetry: number;
  err: Mocha.Error | undefined;
  retries: number;
};

const reportFailedAttempt = ({
  attemptIndex,
  failureIdx,
  formattedTestTitle,
  numAttempts,
  testAttempt,
}: {
  attemptIndex: number;
  failureIdx: number;
  formattedTestTitle: string;
  numAttempts: number;
  testAttempt: FailedTestAttempt;
}): void => {
  const errors: string = [
    // NB: We prepend here because the second error gets passed to us first, for some reason.
    ...(testAttempt.err?.multiple ?? []),
    ...(testAttempt.err !== undefined ? [testAttempt.err] : []),
  ]
    .map(formatErrorMsgAndStack)
    .reduce(
      (output, [msg, stack]) =>
        output +
        (output !== "" ? "\n" : "") +
        reporters.Base.color("error message", msg.replace(/^/gm, "     ")) +
        reporters.Base.color(
          "error stack",
          "\n" + stack.replace(/^/gm, "  ") + "\n"
        ),
      ""
    );

  console.log(
    reporters.Base.color(
      "error title",
      // Only print the failure number on the first attempt we show (since each failed test
      // is only counted once in the stats, and this numbering should match).
      (attemptIndex === 0 ? `  ${failureIdx + 1}) ` : "     ") +
        formattedTestTitle
    ) +
      (numAttempts > 1
        ? reporters.Base.color(
            "medium",
            ` (attempt ${attemptIndex + 1} of ${numAttempts})`
          )
        : "") +
      reporters.Base.color("error title", errors !== "" ? ":\n" : "") +
      errors
  );
};

// Cypress mutates the runnable in response to Mocha events, which can overwrite our modifications
// to the test's `err` field (i.e., its `multiple` field). We store a separate reference to the
// error to prevent this.
type TestWithError<T extends CypressTest | MochaEventTest> = {
  // Omit the `err` field from the type so that we don't accidentally use it.
  test: Omit<T, "err">;
  err: Mocha.Error | undefined;
};

type TestTitle = string[];

// This reporter is a quarantine- and retry-aware TypeScript adaptation of Mocha's spec reporter:
// https://github.com/mochajs/mocha/blob/ccee5f1b37bb405b81814daa35c63801cad20b4d/lib/reporters/spec.js
export default class UnflakableSpecReporter extends reporters.Base {
  static readonly description = "Unflakable reporter: hierarchical & verbose";

  private readonly config: UnflakableConfig;
  private readonly manifest: TestSuiteManifest | null;
  private readonly testFilename: string | null;

  private indents = 0;

  // Used for computing the set of skipped tests from each suite.
  private nonSkippedTestJsonTitlePaths: Set<string> = new Set();
  private specTests: TestTitle[] = [];

  // Non-final failed test attempts.
  private retriedTests: TestWithError<CypressTest | MochaEventTest>[] = [];

  // Final failed test attempts.
  private quarantinedFailures: TestWithError<CypressTest>[] = [];
  private unquarantinedFailures: TestWithError<CypressTest>[] = [];
  private quarantinedFlakes: TestWithError<CypressTest>[] = [];
  private unquarantinedFlakes: TestWithError<CypressTest>[] = [];
  private quarantinedPending: CypressTest[] = [];
  private unquarantinedPending: CypressTest[] = [];

  constructor(runner: Runner, options?: MochaOptions) {
    super(runner, options);

    debug(
      `Constructing runner for suite title=\`${runner.suite.title}\` file=\`${
        runner.suite.file ?? ""
      }\``
    );

    if (
      // NB: typeof null is "object"
      typeof options?.reporterOptions !== "object" ||
      options?.reporterOptions === null
    ) {
      throw new Error("Reporter config not found");
    }
    const { config, manifest, projectRoot, repoRoot } =
      options.reporterOptions as ReporterConfig;
    this.config = config;
    this.manifest = manifest ?? null;
    this.testFilename =
      runner.suite.file !== undefined
        ? path.relative(
            repoRoot,
            // Absolute path of the spec file.
            path.join(projectRoot, runner.suite.file)
          )
        : // This can happen if a file has no tests, which should be ok since none of the event
          // handlers should get called.
          null;
    debug(`Repo-relative test filename: ${this.testFilename ?? "null"}`);

    runner.on(Runner.constants.EVENT_RUN_BEGIN, this.onRunBegin.bind(this));
    runner.once(Runner.constants.EVENT_RUN_END, this.onRunEnd.bind(this));

    runner.on(Runner.constants.EVENT_SUITE_BEGIN, this.onSuiteBegin.bind(this));
    runner.on(Runner.constants.EVENT_SUITE_END, this.onSuiteEnd.bind(this));

    runner.on(Runner.constants.EVENT_TEST_FAIL, this.onTestFail.bind(this));
    runner.on(
      Runner.constants.EVENT_TEST_PENDING,
      this.onTestPending.bind(this)
    );
    // When using the default `spec` Mocha reporter, Cypress registers a retry listener:
    // https://github.com/cypress-io/cypress/blob/b0c0eaa508bb6dafdc1997bc00fb7ed6f5bcc160/packages/server/lib/reporter.js#L268-L278
    runner.on(Runner.constants.EVENT_TEST_RETRY, this.onTestRetry.bind(this));
    // We need an onTestEnd() handler to capture multiple exceptions that occur in the same test
    // (see https://github.com/mochajs/mocha/issues/2906 and
    // https://github.com/mochajs/mocha/pull/4033), which results in a call to onTestFail() followed
    // by a call either to onTestEnd() (for the last retry) or onTestRetry() (for earlier failures).
    runner.on(Runner.constants.EVENT_TEST_END, this.onTestEnd.bind(this));
  }

  private color = (c: keyof ForegroundColor, str: string): string =>
    // Use the same flag as reporters.Base.color so that we don't end up with some colors but not
    // others.
    reporters.Base.useColors
      ? styles.color[c].open + str + styles.color[c].close
      : str;

  private indent = (): string => Array(this.indents).join("  ");

  private isQuarantined = (titlePath: TestTitle): boolean => {
    // For ignore_failure (and skip_tests if somehow the quarantined tests still executed), ignore
    // failures of quarantined tests.
    if (this.config.quarantineMode === "no_quarantine") {
      return false;
    }

    if (this.testFilename === null) {
      throw new Error("Suite has no `file` attribute");
    }

    const isQuarantined =
      this.manifest !== null &&
      isTestQuarantined(this.manifest, this.testFilename, titlePath);

    debug(
      `Test is ${isQuarantined ? "" : "NOT "}quarantined: ${JSON.stringify(
        titlePath
      )} in file ${this.testFilename}`
    );

    return isQuarantined;
  };

  // Retry-aware version of Base.list():
  // https://github.com/mochajs/mocha/blob/1412dc80d87d0479f7f1d60202da2b33c90eb939/lib/reporters/base.js#L209-L283
  private listFailures = (
    failures: TestWithError<CypressTest>[],
    isFlake: boolean
  ): void => {
    console.log();

    failures.forEach((lastTestAttempt, failureIdx: number) => {
      // If the failure occurred in a before/after hook, `test`'s name includes the name of the
      // hook. However, we want quarantine to be based on the test itself, so we look up the test
      // in its parent suite to find the original test title.
      const suiteTest =
        (lastTestAttempt.test.parent?.tests as CypressTest[] | undefined)?.find(
          (suiteTest) => suiteTest.id === lastTestAttempt.test.id
        ) ?? lastTestAttempt.test;

      const testTitle = formatFailedTestTitle(suiteTest.titlePath());

      const failedAttempts: FailedTestAttempt[] = [
        ...this.retriedTests
          .filter(
            (retriedTest) => retriedTest.test.id === lastTestAttempt.test.id
          )
          .map((retriedTest) => ({
            currentRetry: currentTestRetry(retriedTest.test),
            err: retriedTest.err,
            retries: testRetries(retriedTest.test),
          })),
        // For flaky tests, the last attempt is `passed`, which we don't want to print with the
        // failures.
        ...(lastTestAttempt.test.state === "failed"
          ? [
              {
                currentRetry: currentTestRetry(lastTestAttempt.test),
                err: lastTestAttempt.err,
                retries: testRetries(lastTestAttempt.test),
              },
            ]
          : []),
      ].sort((a, b) =>
        a.currentRetry < b.currentRetry
          ? -1
          : a.currentRetry > b.currentRetry
          ? 1
          : 0
      );

      failedAttempts.forEach((testAttempt, attemptIndex: number) =>
        reportFailedAttempt({
          attemptIndex,
          failureIdx,
          formattedTestTitle: testTitle,
          numAttempts: isFlake
            ? failedAttempts.length + 1
            : failedAttempts.length,
          testAttempt,
        })
      );
    });
  };

  private onRunBegin = (): void => {
    debug("onRunBegin");

    // For whatever reason, the xunit Mocha reporter clears reporters.Base.useColors in its
    // onRunEnd handler event. We record its value above and then restore it here so that colors
    // are used (or not) consistently for each spec. This affects our integration tests, but it
    // also makes sense for the production code path. See:
    // https://github.com/mochajs/mocha/blob/1412dc80d87d0479f7f1d60202da2b33c90eb939/lib/reporters/xunit.js#L155
    reporters.Base.useColors = useColors;

    console.log();
  };

  private onRunEnd = (): void => {
    const stats = this.stats as ReporterStats;

    // Mocha considers flakes to be passes, so we need to subtract those from the pass count.
    if (
      this.quarantinedFlakes.length + this.unquarantinedFlakes.length >
      (stats.passes ?? 0)
    ) {
      printWarning(
        `Number of flakes (${
          this.quarantinedFlakes.length + this.unquarantinedFlakes.length
        }) exceeds number of passes (${stats.passes ?? 0})`
      );
    }
    const numPasses = Math.max(
      0,
      (stats.passes ?? 0) -
        this.quarantinedFlakes.length -
        this.unquarantinedFlakes.length
    );

    console.log();

    console.log(
      reporters.Base.color("bright pass", " ") +
        reporters.Base.color("green", ` ${numPasses} passing`) +
        (typeof stats.duration === "number"
          ? reporters.Base.color(
              "light",
              ` (${milliseconds(stats.duration ?? 0)})`
            )
          : "")
    );

    if (this.unquarantinedPending.length > 0) {
      console.log(
        reporters.Base.color(
          "pending",
          `  ${this.unquarantinedPending.length} pending`
        )
      );
    }

    if (this.quarantinedPending.length > 0) {
      console.log(
        this.color(
          "magenta",
          `  ${this.quarantinedPending.length} quarantined pending`
        )
      );

      console.log();

      this.quarantinedPending.forEach((test, testIdx) => {
        console.log(
          reporters.Base.color(
            "error title",
            `  ${testIdx + 1}) ` + formatFailedTestTitle(test.titlePath())
          )
        );
        console.log();
      });

      console.log();
    }

    // NB: We don't use stats.failures here (even if we account for quarantined failures) because
    // it double-counts tests with multiple errors. Our count is more accurate, so we use it
    // instead.
    if (this.unquarantinedFailures.length > 0) {
      console.log(
        reporters.Base.color(
          "fail",
          `  ${this.unquarantinedFailures.length} failing`
        )
      );

      this.listFailures(this.unquarantinedFailures, false);
      console.log();
    }

    if (this.quarantinedFailures.length > 0) {
      console.log(
        this.color(
          "magenta",
          `  ${this.quarantinedFailures.length} quarantined failing`
        )
      );

      this.listFailures(this.quarantinedFailures, false);
      console.log();
    }

    if (this.unquarantinedFlakes.length > 0) {
      console.log(
        reporters.Base.color(
          "medium",
          `  ${this.unquarantinedFlakes.length} flaky`
        )
      );

      this.listFailures(this.unquarantinedFlakes, true);
      console.log();
    }

    if (this.quarantinedFlakes.length > 0) {
      console.log(
        this.color(
          "magenta",
          `  ${this.quarantinedFlakes.length} quarantined flaky`
        )
      );

      this.listFailures(this.quarantinedFlakes, true);
      console.log();
    }

    const { quarantinedSkipped, unquarantinedSkipped } = this.specTests.reduce(
      ({ quarantinedSkipped, unquarantinedSkipped }, testTitle) => {
        if (!this.nonSkippedTestJsonTitlePaths.has(JSON.stringify(testTitle))) {
          if (this.isQuarantined(testTitle)) {
            return {
              quarantinedSkipped: [...quarantinedSkipped, testTitle],
              unquarantinedSkipped,
            };
          } else {
            return {
              quarantinedSkipped,
              unquarantinedSkipped: [...unquarantinedSkipped, testTitle],
            };
          }
        } else {
          return { quarantinedSkipped, unquarantinedSkipped };
        }
      },
      {
        quarantinedSkipped: [] as TestTitle[],
        unquarantinedSkipped: [] as TestTitle[],
      }
    );

    // The Mocha spec reporter doesn't print skipped tests, but it seems worth letting the user
    // know which tests didn't get run due to prior failures.
    if (quarantinedSkipped.length + unquarantinedSkipped.length > 0) {
      console.log(
        this.color(
          "blue",
          `  ${quarantinedSkipped.length + unquarantinedSkipped.length} skipped`
        )
      );

      console.log();

      quarantinedSkipped.forEach((testTitle, idx) => {
        const formattedTestTitle = formatFailedTestTitle(testTitle);
        console.log(
          `  ${idx + 1}) ${formattedTestTitle} ${this.color(
            "magenta",
            "[quarantined]"
          )}`
        );
      });
      unquarantinedSkipped.forEach((testTitle, idx) => {
        const formattedTestTitle = formatFailedTestTitle(testTitle);
        console.log(
          `  ${quarantinedSkipped.length + idx + 1}) ${formattedTestTitle}`
        );
      });

      console.log();
    }

    console.log();

    // We need to update the reporter stats to reflect flakiness and quarantining so that the
    // plugin can print the same stats as the reporter without needing to recompute everything.
    // NB: We can't update this.stats all at once since it's an object shared with the underlying
    // Mocha runnable, and we need to make sure the updates apply to the runnable, which is where
    // the final stats sent back to the plugin come from.
    stats.passes = numPasses;
    stats.failures = this.unquarantinedFailures.length;
    stats.quarantinedFailures = this.quarantinedFailures.length;
    stats.unquarantinedFlakes = this.unquarantinedFlakes.length;
    stats.quarantinedFlakes = this.quarantinedFlakes.length;
    stats.unquarantinedPending = this.unquarantinedPending.length;
    stats.quarantinedPending = this.quarantinedPending.length;
    stats.quarantinedSkipped = quarantinedSkipped.length;
    stats.unquarantinedSkipped = unquarantinedSkipped.length;
  };

  private onSuiteBegin = (suite: Suite): void => {
    debug(
      `onSuiteBegin title=\`${suite.title}\` file=\`${
        suite.file ?? ""
      }\` root=${String(suite.root)}`
    );

    suite.tests.forEach((test) => {
      this.specTests.push(test.titlePath());
    });

    this.indents++;
    console.log(reporters.Base.color("suite", this.indent() + suite.title));
  };

  private onSuiteEnd = (suite: Suite): void => {
    debug(
      `onSuiteEnd title=\`${suite.title}\` file=\`${
        suite.file ?? ""
      }\` root=${String(suite.root)}`
    );

    this.indents--;
    if (this.indents === 1) {
      console.log();
    }
  };

  // This handler gets called under two circumstances:
  //  1) The final retry of a test fails (including cases where Cypress won't retry a test due to
  //     a before/after hook failing).
  //  2) A test fails with multiple errors (see https://github.com/mochajs/mocha/issues/2906 and
  //     https://github.com/mochajs/mocha/pull/4033). We can detect this case by checking whether
  //     test.currentRetry() < test.retries(). In this case, onTestFail() will get called with the
  //     second exception, followed by onTestEnd() getting called with the first exception. After
  //     some testing, it doesn't seem like there can ever be more than two exceptions.
  private onTestFail = (test: CypressTest, _err?: Mocha.Error): void => {
    debug(
      `onTestFail [${test.state ?? "no state"}] ${test.title}: ${
        test.err?.message ?? ""
      }`
    );

    // If the failure occurred in a before/after hook, `test`'s name includes the name of the hook.
    // However, we want quarantine to be based on the test itself, so we look up the test in its
    // parent suite to find the original test title.
    const suiteTest =
      (test.parent?.tests as CypressTest[] | undefined)?.find(
        (suiteTest) => suiteTest.id === test.id
      ) ?? test;

    // Case (2) above, or case (1) when Cypress won't retry due to a before/after all hook failing.
    // Unfortunately, we can't determine at this point whether the test will be retried or not, so
    // we assume that it will, and then handle the edge case in onTestEnd().
    if (currentTestRetry(test) < testRetries(test)) {
      this.retriedTests.push({ test, err: test.err });
    } else if (this.isQuarantined(suiteTest.titlePath())) {
      pushOrMergeFailedTest(this.quarantinedFailures, test);
    } else {
      pushOrMergeFailedTest(this.unquarantinedFailures, test);
    }

    // NB: We don't print any output in this function since, for non-final-attempts, it only gets
    // called if there are multiple errors. Instead, we print the result of each test attempt in
    // onTestEnd() or onTestRetry().
  };

  private reportTestPassed = (test: CypressTest): void => {
    const currentRetry = currentTestRetry(test);

    const isFlaky = currentRetry > 0;
    const isQuarantined = isFlaky && this.isQuarantined(test.titlePath());
    if (isFlaky && isQuarantined) {
      this.quarantinedFlakes.push({ test, err: test.err });
    } else if (isFlaky) {
      this.unquarantinedFlakes.push({ test, err: test.err });
    }

    // Cypress overrides the behavior of the Mocha spec reporter (see
    // https://github.com/cypress-io/cypress/blob/b0c0eaa508bb6dafdc1997bc00fb7ed6f5bcc160/packages/server/lib/reporter.js#L296-L309):
    // Override the default reporter to always show test timing even for fast tests and display
    // slow ones in yellow rather than red.
    const durationColor = test.speed === "slow" ? "medium" : "fast";

    const symbolFmt = `  ${reporters.Base.symbols.ok}`;

    // Log: `✓ test title (300ms)` when a test passes
    console.log(
      Array(testDepth(test)).join("  ") +
        (isQuarantined
          ? this.color("magenta", symbolFmt)
          : reporters.Base.color(isFlaky ? "medium" : "checkmark", symbolFmt)) +
        reporters.Base.color("pass", ` ${test.title}`) +
        (isQuarantined
          ? this.color("magenta", " [flaky, quarantined]")
          : isFlaky
          ? reporters.Base.color("medium", " [flaky]")
          : "") +
        retryAttempt(test, false) +
        (test.duration !== undefined
          ? reporters.Base.color(durationColor, ` (${test.duration}ms)`)
          : "")
    );
  };

  private reportTestFailed = (test: CypressTest): void => {
    const isQuarantined = this.isQuarantined(test.titlePath());

    if (isQuarantined) {
      pushOrMergeFailedTest(this.quarantinedFailures, test);
    } else {
      pushOrMergeFailedTest(this.unquarantinedFailures, test);
    }

    const quarantinedFmt = `  ${reporters.Base.symbols.err} ${test.title} [failed, quarantined]`;

    console.log(
      Array(testDepth(test)).join("  ") +
        (isQuarantined
          ? reporters.Base.useColors
            ? this.color("magenta", quarantinedFmt)
            : quarantinedFmt
          : reporters.Base.color(
              "fail",
              `  ${reporters.Base.symbols.err} ${test.title}`
            )) +
        retryAttempt(test, false)
    );
  };

  // This handler gets called after the final attempt of each test, so it's where we determine the
  // test's overall outcome and whether it's quarantined.
  // NB: An `err` argument is never passed to this event handler.
  private onTestEnd = (test: CypressTest): void => {
    debug(
      `onTestEnd [${test.state ?? "no state"}] ${test.title}: ${
        test.err?.message ?? ""
      }`
    );

    this.nonSkippedTestJsonTitlePaths.add(JSON.stringify(test.titlePath()));

    if (test.state === "passed") {
      this.reportTestPassed(test);
    } else if (test.state === "failed") {
      const currentRetry = currentTestRetry(test);
      // Edge case: a test failed and won't be retried due to a before()/after() hook failing. In
      // this case, we already added the test to this.retriedTests in onTestFail() (where it was
      // too soon to tell whether the test was going to be retried). To avoid printing this attempt
      // twice, we need to remove it from this.retriedTests, and possibly combine it with the
      // current attempt if the test had multiple errors.
      if (currentRetry < testRetries(test)) {
        const existingTestFailureIdx = this.retriedTests.findIndex(
          (existingTestFailure) =>
            existingTestFailure.test.id === test.id &&
            currentTestRetry(existingTestFailure.test) === currentRetry
        );
        if (existingTestFailureIdx !== -1) {
          const existingTestFailure = this.retriedTests.splice(
            existingTestFailureIdx,
            1
          )[0];

          // Swap the order of the tests since the second error gets reported to us first (in cases
          // of tests with multiple errors), and in this case we're keeping the current `test`
          // object instead of `existingTestFailure` (which only has the serialized Mocha fields).
          [existingTestFailure.err, test.err] = [
            test.err,
            existingTestFailure.err,
          ];
          mergeTestFailure(existingTestFailure, test);
        }
      }

      this.reportTestFailed(test);
    }
    // NB: pending tests are handled in onTestPending since onTestEnd isn't usually called for
    // pending tests.
  };

  // Handles pending tests since onTestEnd isn't usually called for pending tests.
  private onTestPending = (test: CypressTest, _err?: Mocha.Error): void => {
    debug(
      `onTestPending [${test.state ?? "no state"}] ${test.title}: ${
        test.err?.message ?? ""
      }`
    );

    const titlePath = test.titlePath();
    const titlePathJson = JSON.stringify(titlePath);
    // onTestEnd() doesn't get called for pending (it.skip()) tests.
    this.nonSkippedTestJsonTitlePaths.add(titlePathJson);

    // We don't expect tests to be pending during retry. If this happens, there's likely some
    // shenanigans going on in the test itself to call it.skip() during retry. Just print a
    // warning in this case rather than treating the test as flaky or potentially quarantining
    // it.
    if (currentTestRetry(test) > 0) {
      if (this.testFilename === null) {
        throw new Error("Suite has no `file` attribute");
      }

      printWarning(
        `test ${titlePathJson} in file ${this.testFilename} was pending (skipped) during retry`
      );
    }

    const isQuarantined =
      this.isQuarantined(titlePath) &&
      this.config.quarantineMode === "skip_tests";
    if (isQuarantined) {
      this.quarantinedPending.push(test);
    } else {
      this.unquarantinedPending.push(test);
    }

    console.log(
      Array(testDepth(test)).join("  ") +
        reporters.Base.color("pending", `  - ${test.title}`) +
        (isQuarantined ? this.color("magenta", " [quarantined]") : "") +
        retryAttempt(test, false)
    );
  };

  // NB: An `err` argument is never passed to this event handler.
  private onTestRetry = (
    test: MochaEventTest & { hookName?: string }
  ): void => {
    debug(
      `onTestRetry [${test.state ?? "no state"}] ${test.title}: ${
        test.err?.message ?? ""
      }`
    );

    // Edge case: onTestRetry() gets called twice if a test fails and its afterEach() hook also
    // fails. However, we don't want to print the failed attempt twice in that case.
    if (
      pushOrMergeFailedTest(this.retriedTests, test) ||
      test.hookName === undefined
    ) {
      console.log(
        this.indent() +
          reporters.Base.color(
            "fail",
            `  ${reporters.Base.symbols.err} ${test.title}`
          ) +
          retryAttempt(test, true)
      );
    }
  };
}
