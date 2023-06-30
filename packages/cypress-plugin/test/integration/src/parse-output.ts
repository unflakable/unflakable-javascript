// Copyright (c) 2023 Developer Innovations, LLC

/* eslint-disable no-control-regex */

import { specPattern, TEST_SPEC_STUBS, TestCaseParams } from "./run-test-case";

export type RunStarting = {
  specs: string[];
};

export type AttemptInfo = {
  attemptNum: number;
  totalAttempts: number;
};

export type NonPassingTestAttempt = {
  titlePath: string[];
  attempt: AttemptInfo | undefined;
  errorLines: string[];
};

export type FailedTest = {
  attempts: NonPassingTestAttempt[];
};

export type SkippedTest = {
  titlePath: string[];
  isQuarantined: boolean;
};

export type TestCountWithFailures<T> = {
  count: number;
  tests: T[];
};

export type ReporterOutput = {
  suitesAndTestAttempts: string[];
  passing: number;
  pending: number;
  quarantinedPending: TestCountWithFailures<FailedTest>;
  failures: TestCountWithFailures<FailedTest>;
  quarantinedFailures: TestCountWithFailures<FailedTest>;
  flakes: TestCountWithFailures<FailedTest>;
  quarantinedFlakes: TestCountWithFailures<FailedTest>;
  skipped: TestCountWithFailures<SkippedTest>;
};

export const EMPTY_REPORTER_OUTPUT_MATCH: ReporterOutput = {
  suitesAndTestAttempts: [],
  passing: 0,
  pending: 0,
  quarantinedPending: { count: 0, tests: [] },
  failures: { count: 0, tests: [] },
  quarantinedFailures: { count: 0, tests: [] },
  flakes: { count: 0, tests: [] },
  quarantinedFlakes: { count: 0, tests: [] },
  skipped: { count: 0, tests: [] },
};

export type SpecResults = {
  color: "pass" | "fail";
  numTests: number;
  numPassing: number;
  numFailing: number;
  numFlaky: number;
  numQuarantined: number;
  numPending: number;
  numSkipped: number;
};

export const EMPTY_RESULTS: Omit<SpecResults, "color"> = {
  numTests: 0,
  numPassing: 0,
  numFailing: 0,
  numFlaky: 0,
  numQuarantined: 0,
  numPending: 0,
  numSkipped: 0,
};

export type SpecOutput = {
  // This is relative to common root. Since all the tests are in the same directory, it's just the
  // basename (e.g., pass.cy.ts).
  filename: string;
  reporterOutput: ReporterOutput;
  results: SpecResults;
};

export type SummaryRow = {
  icon: "pass" | "fail";
  specName: string;
  numTests: number;
  numPassing: number;
  numFailing: number;
  numFlaky: number;
  numQuarantined: number;
  numPending: number;
  numSkipped: number;
};

export type SummaryTotals = {
  icon: "pass" | "fail";
  numTests: number;
  numPassing: number;
  numFailing: number;
  numFlaky: number;
  numQuarantined: number;
  numPending: number;
  numSkipped: number;
};

export type Summary = {
  rows: SummaryRow[];
  totals: SummaryTotals;
};

export type ParsedOutput = {
  runStarting: RunStarting | null;
  specOutputs: SpecOutput[];
  summary: Summary;
  unflakableReportUrl: string | null;
};

const TABLE_TOP_BORDER_LINE =
  // eslint-disable-next-line no-control-regex
  /^\x1B\[90m +┌(\x1B\[39m\x1B\[90m─)+\x1B\[39m\x1B\[90m┐\x1B\[39m$/;
const TABLE_BETWEEN_ROWS_BORDER_LINE =
  /^\x1B\[90m +├(?:\x1B\[39m\x1B\[90m─)+\x1B\[39m\x1B\[90m┤\x1B\[39m$/;
const TABLE_BOTTOM_BORDER_LINE =
  // eslint-disable-next-line no-control-regex
  /^\x1B\[90m +└(\x1B\[39m\x1B\[90m─)+\x1B\[39m\x1B\[90m┘\x1B\[39m$/;

const parseKeyValueTableEntries = (
  lines: string[]
): { [key in string]: string } =>
  lines.reduce(
    ({ entries, lastKey }, line) => {
      const parsedLine = line.match(
        // eslint-disable-next-line no-control-regex
        /^\x1B\[90m +│\x1B\[39m(?: \x1B\[90m(.+):\x1B\[39m)? +(?:\x1B\[0m)?(.*?)(?:\x1B\[0m)? +\x1B\[90m│\x1B\[39m$/
      );
      expect(
        parsedLine,
        `invalid key-value table row ${JSON.stringify(line)}`
      ).not.toBeNull();
      const key = (parsedLine as RegExpMatchArray)[1];
      const value = (parsedLine as RegExpMatchArray)[2];

      // Long values can span multiple lines, so we concatenate them below.
      if (key === undefined) {
        expect(lastKey).toBeDefined();
        return {
          entries: {
            ...entries,
            [lastKey as string]: entries[lastKey as string] + value,
          },
          lastKey,
        };
      } else {
        // Disallow duplicate keys.
        expect(Object.keys(entries)).not.toContain(key);
        return {
          entries: {
            ...entries,
            [key]: value,
          },
          lastKey: key,
        };
      }
    },
    {
      entries: {} as { [key in string]: string },
      lastKey: undefined as string | undefined,
    }
  ).entries;

const parseRunStarting = (
  params: TestCaseParams,
  stdoutLines: string[]
): {
  linesRead: number;
  runStarting: RunStarting;
} => {
  const runStartingLine = stdoutLines.findIndex(
    (line) =>
      line === "\x1B[0m  (\x1B[4m\x1B[1mRun Starting\x1B[22m\x1B[24m)\x1B[0m"
  );
  expect(runStartingLine).not.toBe(-1);

  expect(stdoutLines[runStartingLine + 2]).toMatch(TABLE_TOP_BORDER_LINE);
  const numTableLines = stdoutLines
    .slice(runStartingLine + 3)
    .findIndex(TABLE_BOTTOM_BORDER_LINE.test.bind(TABLE_BOTTOM_BORDER_LINE));
  expect(numTableLines).not.toBe(-1);

  const tableEntries = parseKeyValueTableEntries(
    stdoutLines.slice(runStartingLine + 3, runStartingLine + 3 + numTableLines)
  );

  expect(Object.keys(tableEntries)).toStrictEqual([
    "Cypress",
    "Browser",
    "Node Version",
    "Specs",
    "Searched",
  ]);

  expect(tableEntries["Cypress"]).toMatch(/^[0-9]+\.[0-9]+\.[0-9]+$/);
  expect(tableEntries["Browser"]).toMatch(
    new RegExp(
      `^${
        // Chrome is slow to launch on Windows.
        process.platform === "win32" ? "Edge" : "Chrome"
      } [0-9]+ \x1B\\[90m\\(headless\\)\x1B\\[39m$`
    )
  );
  expect(tableEntries["Node Version"]).toMatch(
    new RegExp(
      `^${process.version.replace(
        // Replace all occurrences.
        /\./g,
        "\\."
      )} \\x1B\\[90m\\(.+\\)\\x1B\\[39m$`
    )
  );
  expect(tableEntries["Searched"]).toBe(specPattern(params));

  const parsedSpecsLine = tableEntries["Specs"].match(
    /^([0-9]+) found \((.*)\)$/
  );
  expect(parsedSpecsLine).not.toBeNull();
  const numSpecs = Number.parseInt((parsedSpecsLine as RegExpMatchArray)[1]);
  const specs = (parsedSpecsLine as RegExpMatchArray)[2].split(", ");
  expect(specs).toHaveLength(numSpecs);

  return {
    linesRead: runStartingLine + 3 + numTableLines + 2,
    runStarting: {
      specs,
    },
  };
};

const REPORTER_SPEC_OUTPUT_RUNNING_LINE =
  /^ *Running: +\x1B\[90m(.+)\x1B\[39m +\x1B\[90m\(([0-9]+) of ([0-9]+)\)\x1B\[39m$/;
const REPORTER_SPEC_OUTPUT_TESTS_PASSING_LINE =
  /^\x1B\[92m \x1B\[0m\x1B\[32m ([0-9]+) passing\x1B\[0m\x1B\[90m \([0-9]+.+?\)\x1B\[0m$/;
const REPORTER_SPEC_OUTPUT_TESTS_PENDING_LINE =
  /^\x1B\[36m {2}([0-9]+) pending\x1B\[0m$/;
const REPORTER_SPEC_OUTPUT_TESTS_QUARANTINED_PENDING_LINE =
  /^\x1B\[35m {2}([0-9]+) quarantined pending\x1B\[39m$/;
const REPORTER_SPEC_OUTPUT_TESTS_FAILING_LINE =
  /^\x1B\[31m {2}([0-9]+) failing\x1B\[0m$/;
const REPORTER_SPEC_OUTPUT_TESTS_QUARANTINED_FAILING_LINE =
  /^\x1B\[35m {2}([0-9]+) quarantined failing\x1B\[39m$/;
const REPORTER_SPEC_OUTPUT_TESTS_FLAKY_LINE =
  /^\x1B\[33m {2}([0-9]+) flaky\x1B\[0m$/;
const REPORTER_SPEC_OUTPUT_TESTS_QUARANTINED_FLAKY_LINE =
  /^\x1B\[35m {2}([0-9]+) quarantined flaky\x1B\[39m$/;
const REPORTER_SPEC_OUTPUT_TESTS_SKIPPED_LINE =
  /^\x1B\[34m {2}([0-9]+) skipped\x1B\[39m$/;
const REPORTER_SPEC_OUTPUT_TESTS_LINE = new RegExp(
  [
    REPORTER_SPEC_OUTPUT_TESTS_PASSING_LINE.source,
    REPORTER_SPEC_OUTPUT_TESTS_PENDING_LINE.source,
    REPORTER_SPEC_OUTPUT_TESTS_QUARANTINED_PENDING_LINE.source,
    REPORTER_SPEC_OUTPUT_TESTS_FAILING_LINE.source,
    REPORTER_SPEC_OUTPUT_TESTS_QUARANTINED_FAILING_LINE.source,
    REPORTER_SPEC_OUTPUT_TESTS_FLAKY_LINE.source,
    REPORTER_SPEC_OUTPUT_TESTS_QUARANTINED_FLAKY_LINE.source,
    REPORTER_SPEC_OUTPUT_TESTS_SKIPPED_LINE.source,
  ].join("|")
);

const REPORTER_NON_PASSING_TEST_LINE =
  /^(\x1B\[0m)? +(?:([0-9]+)\) )?(.+?)(?:\x1B\[0m\x1B\[33m \(attempt ([0-9]+) of ([0-9]+)\))?(?:\x1B\[0m){0,2}(:)?$/;
const REPORTER_SKIPPED_TEST_LINE =
  /^ +(?:([0-9]+)\) )?(.+?)( \x1B\[35m\[quarantined]\x1B\[39m)?$/;

const PLUGIN_SPEC_RESULTS_LINE =
  /^\x1B\[3([12])m {2}\(\x1B\[4m\x1B\[1mResults\x1B\[22m\x1B\[24m\)\x1B\[39m$/;

const PLUGIN_SPEC_RESULTS_TABLE_VALUE = /^\x1B\[3([12])m(.*)\x1B\[39m$/;

// We expect the output to be in a specific order, which we track with these finite states in
// increasing order.
enum ReporterTestsParseOuterState {
  Init = 0,
  Passing = 1,
  Pending = 2,
  QuarantinedPending = 3,
  Failing = 4,
  QuarantinedFailing = 5,
  Flaky = 6,
  QuarantinedFlaky = 7,
  Skipped = 8,
}

enum ReporterTestsParseInnerState {
  Init = 0,
  Title = 1,
  Errors = 2,
}

type ReporterTestsParser = {
  innerState: ReporterTestsParseInnerState;
  outerState: ReporterTestsParseOuterState;
  results: Omit<ReporterOutput, "suitesAndTestAttempts">;
};

const mergeOutputTestsLine = (
  parseState: ReporterTestsParser,
  nextState: ReporterTestsParseOuterState,
  resultsUpdate: Partial<Omit<ReporterOutput, "suitesAndTestAttempts">>
): ReporterTestsParser => {
  expect(parseState.outerState).toBeLessThan(nextState);
  return {
    ...parseState,
    results: {
      ...parseState.results,
      ...resultsUpdate,
    },
    outerState: nextState,
    innerState: ReporterTestsParseInnerState.Init,
  };
};

const nonPassingStateToResultsField = (
  outerState: ReporterTestsParseOuterState
):
  | "quarantinedPending"
  | "failures"
  | "quarantinedFailures"
  | "flakes"
  | "quarantinedFlakes" => {
  switch (outerState) {
    case ReporterTestsParseOuterState.Init:
    case ReporterTestsParseOuterState.Passing:
    case ReporterTestsParseOuterState.Pending:
    case ReporterTestsParseOuterState.Skipped:
      throw new Error(
        `State ${outerState} should not have non-passing tests reported`
      );
    case ReporterTestsParseOuterState.QuarantinedPending:
      return "quarantinedPending";
    case ReporterTestsParseOuterState.Failing:
      return "failures";
    case ReporterTestsParseOuterState.QuarantinedFailing:
      return "quarantinedFailures";
    case ReporterTestsParseOuterState.Flaky:
      return "flakes";
    case ReporterTestsParseOuterState.QuarantinedFlaky:
      return "quarantinedFlakes";
  }
};

const withUpdatedLastElement = <T>(arr: T[], updateFn: (elem: T) => T): T[] => [
  ...arr.slice(0, arr.length - 1),
  updateFn(arr[arr.length - 1]),
];

const parseSpecOutputs = (
  params: TestCaseParams,
  stdoutLinesAfterRunStarting: string[]
): {
  linesRead: number;
  specOutputs: SpecOutput[];
} => {
  const { specOffsets } = stdoutLinesAfterRunStarting.reduce(
    ({ specOffsets }, line, lineIndex) =>
      REPORTER_SPEC_OUTPUT_RUNNING_LINE.test(line)
        ? { specOffsets: [...specOffsets, lineIndex] }
        : { specOffsets },
    {
      specOffsets: [] as number[],
    }
  );

  const specOutputs = specOffsets.map(
    (
      specOffset,
      specIndex
    ): SpecOutput & {
      lastLineRead: number;
    } => {
      const parsedRunning = stdoutLinesAfterRunStarting[specOffset].match(
        REPORTER_SPEC_OUTPUT_RUNNING_LINE
      );
      expect(parsedRunning).not.toBeNull();
      const filename = (parsedRunning as RegExpMatchArray)[1];
      try {
        const specNumber = (parsedRunning as RegExpMatchArray)[2];
        const totalSpecs = (parsedRunning as RegExpMatchArray)[3];

        expect(specNumber).toBe((specIndex + 1).toString());
        expect(totalSpecs).toBe(
          params.specNameStubs !== undefined && params.specNameStubs.length > 0
            ? params.specNameStubs.length.toString()
            : TEST_SPEC_STUBS.length.toString()
        );

        const stdoutLinesAfterRunning = stdoutLinesAfterRunStarting.slice(
          specOffset + 2
        );

        // NB: For component tests, webpack emits 3 lines with the number of assets, modules, and a
        // summary of the compilation result. Sometimes these lines are printed above the Running
        // line, and sometimes below. This seems to be non-deterministic.

        // The reporter prints a blank line with the suite chalk color code for the root suite
        // (which has an empty title). This will only get printed if at least one test exists in
        // the spec.
        const rootSuiteLine = stdoutLinesAfterRunning.findIndex(
          (line) => line === "\x1B[0m\x1B[0m"
        );

        const resultsLineIndex = stdoutLinesAfterRunning.findIndex(
          PLUGIN_SPEC_RESULTS_LINE.test.bind(PLUGIN_SPEC_RESULTS_LINE)
        );
        expect(resultsLineIndex).not.toBe(-1);

        const testsPassingLine = stdoutLinesAfterRunning.findIndex(
          REPORTER_SPEC_OUTPUT_TESTS_PASSING_LINE.test.bind(
            REPORTER_SPEC_OUTPUT_TESTS_PASSING_LINE
          )
        );
        expect(testsPassingLine).not.toBe(-1);

        // NB: The spec may not have any suites or tests.
        const suitesAndTestAttempts =
          rootSuiteLine !== -1 && rootSuiteLine < resultsLineIndex
            ? stdoutLinesAfterRunning
                .slice(rootSuiteLine + 1, testsPassingLine)
                .filter((line) => line !== "")
            : [];

        const { results: reporterResults } = stdoutLinesAfterRunning
          .slice(testsPassingLine, resultsLineIndex)
          .reduce<ReporterTestsParser>(
            (parseState, line) => {
              // Skip blank lines.
              if (["", "\x1B[0m"].includes(line)) {
                return parseState;
              }

              const parsedTestsLine = line.match(
                REPORTER_SPEC_OUTPUT_TESTS_LINE
              );
              if (parsedTestsLine !== null) {
                if (parsedTestsLine[1] !== undefined) {
                  return mergeOutputTestsLine(
                    parseState,
                    ReporterTestsParseOuterState.Passing,
                    { passing: parseInt(parsedTestsLine[1]) }
                  );
                } else if (parsedTestsLine[2] !== undefined) {
                  return mergeOutputTestsLine(
                    parseState,
                    ReporterTestsParseOuterState.Pending,
                    { pending: parseInt(parsedTestsLine[2]) }
                  );
                } else if (parsedTestsLine[3] !== undefined) {
                  return mergeOutputTestsLine(
                    parseState,
                    ReporterTestsParseOuterState.QuarantinedPending,
                    {
                      quarantinedPending: {
                        count: parseInt(parsedTestsLine[3]),
                        tests: [],
                      },
                    }
                  );
                } else if (parsedTestsLine[4] !== undefined) {
                  return mergeOutputTestsLine(
                    parseState,
                    ReporterTestsParseOuterState.Failing,
                    {
                      failures: {
                        count: parseInt(parsedTestsLine[4]),
                        tests: [],
                      },
                    }
                  );
                } else if (parsedTestsLine[5] !== undefined) {
                  return mergeOutputTestsLine(
                    parseState,
                    ReporterTestsParseOuterState.QuarantinedFailing,
                    {
                      quarantinedFailures: {
                        count: parseInt(parsedTestsLine[5]),
                        tests: [],
                      },
                    }
                  );
                } else if (parsedTestsLine[6] !== undefined) {
                  return mergeOutputTestsLine(
                    parseState,
                    ReporterTestsParseOuterState.Flaky,
                    {
                      flakes: {
                        count: parseInt(parsedTestsLine[6]),
                        tests: [],
                      },
                    }
                  );
                } else if (parsedTestsLine[7] !== undefined) {
                  return mergeOutputTestsLine(
                    parseState,
                    ReporterTestsParseOuterState.QuarantinedFlaky,
                    {
                      quarantinedFlakes: {
                        count: parseInt(parsedTestsLine[7]),
                        tests: [],
                      },
                    }
                  );
                } else if (parsedTestsLine[8] !== undefined) {
                  return mergeOutputTestsLine(
                    parseState,
                    ReporterTestsParseOuterState.Skipped,
                    {
                      skipped: {
                        count: parseInt(parsedTestsLine[8]),
                        tests: [],
                      },
                    }
                  );
                }
              }

              if (
                parseState.outerState === ReporterTestsParseOuterState.Skipped
              ) {
                const parsedSkippedTestLineOrNull = line.match(
                  REPORTER_SKIPPED_TEST_LINE
                );
                expect(parsedSkippedTestLineOrNull).not.toBeNull();
                const parsedSkippedTestLine =
                  parsedSkippedTestLineOrNull as RegExpMatchArray;

                if (parsedSkippedTestLine[1] !== undefined) {
                  // Start of new test
                  return {
                    ...parseState,
                    results: {
                      ...parseState.results,
                      skipped: {
                        ...parseState.results.skipped,
                        tests: [
                          ...parseState.results.skipped.tests,
                          {
                            titlePath: [parsedSkippedTestLine[2]],
                            isQuarantined:
                              parsedSkippedTestLine[3] !== undefined,
                          },
                        ],
                      },
                    },
                    innerState: ReporterTestsParseInnerState.Title,
                  };
                } else {
                  expect(parseState.innerState).toBe(
                    ReporterTestsParseInnerState.Title
                  );
                  // Continuation of current test title path.
                  return {
                    ...parseState,
                    results: {
                      ...parseState.results,
                      skipped: {
                        ...parseState.results.skipped,
                        tests: withUpdatedLastElement(
                          parseState.results.skipped.tests,
                          (test) => ({
                            titlePath: [
                              ...test.titlePath,
                              parsedSkippedTestLine[2],
                            ],
                            isQuarantined:
                              test.isQuarantined ||
                              parsedSkippedTestLine[3] !== undefined,
                          })
                        ),
                      },
                    },
                    innerState: ReporterTestsParseInnerState.Title,
                  };
                }
              } else {
                const fieldToUpdate = nonPassingStateToResultsField(
                  parseState.outerState
                );

                const parsedNonPassingTestLine = line.match(
                  REPORTER_NON_PASSING_TEST_LINE
                );
                if (
                  parsedNonPassingTestLine !== null &&
                  (parsedNonPassingTestLine[1] !== undefined ||
                    parseState.innerState !==
                      ReporterTestsParseInnerState.Errors)
                ) {
                  const hasErrors = parsedNonPassingTestLine[6] !== undefined;
                  const attempt: AttemptInfo | undefined =
                    parsedNonPassingTestLine[4] !== undefined &&
                    parsedNonPassingTestLine[5] !== undefined
                      ? {
                          attemptNum: Number.parseInt(
                            parsedNonPassingTestLine[4]
                          ),
                          totalAttempts: Number.parseInt(
                            parsedNonPassingTestLine[5]
                          ),
                        }
                      : undefined;

                  const newInnerState = hasErrors
                    ? ReporterTestsParseInnerState.Errors
                    : ReporterTestsParseInnerState.Title;
                  if (parsedNonPassingTestLine[2] !== undefined) {
                    // Start of new test
                    return {
                      ...parseState,
                      results: {
                        ...parseState.results,
                        [fieldToUpdate]: {
                          ...parseState.results[fieldToUpdate],
                          tests: [
                            ...parseState.results[fieldToUpdate].tests,
                            {
                              attempts: [
                                {
                                  titlePath: [parsedNonPassingTestLine[3]],
                                  attempt,
                                  errorLines: [],
                                },
                              ],
                            },
                          ],
                        },
                      },
                      innerState: newInnerState,
                    };
                  } else if (
                    parseState.innerState === ReporterTestsParseInnerState.Title
                  ) {
                    // Continuation of current test title path.
                    return {
                      ...parseState,
                      results: {
                        ...parseState.results,
                        [fieldToUpdate]: {
                          ...parseState.results[fieldToUpdate],
                          tests: withUpdatedLastElement(
                            parseState.results[fieldToUpdate].tests,
                            (test) => ({
                              attempts: withUpdatedLastElement(
                                test.attempts,
                                (testAttempt) => ({
                                  titlePath: [
                                    ...testAttempt.titlePath,
                                    parsedNonPassingTestLine[3],
                                  ],
                                  attempt,
                                  errorLines: [],
                                })
                              ),
                            })
                          ),
                        },
                      },
                      innerState: newInnerState,
                    };
                  } else {
                    // Start of new attempt within current test.
                    expect(parseState.innerState).toBe(
                      ReporterTestsParseInnerState.Errors
                    );
                    return {
                      ...parseState,
                      results: {
                        ...parseState.results,
                        [fieldToUpdate]: {
                          ...parseState.results[fieldToUpdate],
                          tests: withUpdatedLastElement(
                            parseState.results[fieldToUpdate].tests,
                            (test) => ({
                              attempts: [
                                ...test.attempts,
                                {
                                  titlePath: [parsedNonPassingTestLine[3]],
                                  attempt,
                                  errorLines: [],
                                },
                              ],
                            })
                          ),
                        },
                      },
                      innerState: newInnerState,
                    };
                  }
                } else {
                  // Next error line.
                  expect([
                    ReporterTestsParseInnerState.Errors,
                    ReporterTestsParseInnerState.Title,
                  ]).toContainEqual(parseState.innerState);

                  return {
                    ...parseState,
                    results: {
                      ...parseState.results,
                      [fieldToUpdate]: {
                        ...parseState.results[fieldToUpdate],
                        tests: withUpdatedLastElement(
                          parseState.results[fieldToUpdate].tests,
                          (test) => ({
                            attempts: withUpdatedLastElement(
                              test.attempts,
                              (testAttempt) => ({
                                ...testAttempt,
                                errorLines: [
                                  ...testAttempt.errorLines,
                                  line.trim(),
                                ],
                              })
                            ),
                          })
                        ),
                      },
                    },
                  };
                }
              }
            },
            {
              results: {
                passing: 0,
                pending: 0,
                quarantinedPending: { count: 0, tests: [] },
                failures: { count: 0, tests: [] },
                quarantinedFailures: { count: 0, tests: [] },
                flakes: { count: 0, tests: [] },
                quarantinedFlakes: { count: 0, tests: [] },
                skipped: { count: 0, tests: [] },
              },
              innerState: ReporterTestsParseInnerState.Init,
              outerState: ReporterTestsParseOuterState.Init,
            }
          );

        const resultsLine = stdoutLinesAfterRunning[resultsLineIndex];
        const parsedResultsLine = resultsLine.match(PLUGIN_SPEC_RESULTS_LINE);
        expect(parsedResultsLine).not.toBeNull();
        const resultsColor =
          (parsedResultsLine as RegExpMatchArray)[1] === "2" ? "pass" : "fail";

        expect(stdoutLinesAfterRunning[resultsLineIndex + 2]).toMatch(
          TABLE_TOP_BORDER_LINE
        );
        const numTableLines = stdoutLinesAfterRunning
          .slice(resultsLineIndex + 3)
          .findIndex(
            TABLE_BOTTOM_BORDER_LINE.test.bind(TABLE_BOTTOM_BORDER_LINE)
          );
        expect(numTableLines).not.toBe(-1);

        const tableEntries = Object.fromEntries(
          Object.entries(
            parseKeyValueTableEntries(
              stdoutLinesAfterRunning.slice(
                resultsLineIndex + 3,
                resultsLineIndex + 3 + numTableLines
              )
            )
          ).map(([key, value]) => {
            // Strip chalk formatting applied to every value.
            const valueInner = value.match(PLUGIN_SPEC_RESULTS_TABLE_VALUE);
            expect(
              valueInner,
              `Value ${JSON.stringify(
                value
              )} for table key \`${key}\` should match /${
                PLUGIN_SPEC_RESULTS_TABLE_VALUE.source
              }/`
            ).not.toBeNull();
            return [
              key,
              {
                color:
                  (valueInner as RegExpMatchArray)[1] === "1" ? "red" : "green",
                value: (valueInner as RegExpMatchArray)[2],
              },
            ];
          })
        );

        expect(tableEntries["Tests"]?.value).toMatch(/^[0-9]+$/);
        const resultColor = tableEntries["Tests"].color;

        expect(tableEntries["Passing"]?.value).toMatch(/^[0-9]+$/);
        expect(tableEntries["Passing"].color).toBe(resultColor);

        expect(tableEntries["Failing"]?.value).toMatch(/^[0-9]+$/);
        expect(tableEntries["Failing"].color).toBe(resultColor);

        if ("Flaky" in tableEntries) {
          expect(tableEntries["Flaky"].value).toMatch(/^[0-9]+$/);
          expect(tableEntries["Flaky"].color).toBe(resultColor);
        }

        if ("Quarantined" in tableEntries) {
          expect(tableEntries["Quarantined"].value).toMatch(/^[0-9]+$/);
          expect(tableEntries["Quarantined"].color).toBe(resultColor);
        }

        expect(tableEntries["Pending"]?.value).toMatch(/^[0-9]+$/);
        expect(tableEntries["Pending"].color).toBe(resultColor);

        expect(tableEntries["Skipped"]?.value).toMatch(/^[0-9]+$/);
        expect(tableEntries["Skipped"].color).toBe(resultColor);

        expect(tableEntries["Screenshots"]?.value).toMatch(/^[0-9]+$/);
        expect(tableEntries["Screenshots"].color).toBe(resultColor);

        expect(tableEntries["Video"]?.value).toMatch(/^true|false$/);
        expect(tableEntries["Video"].color).toBe(resultColor);

        expect(tableEntries["Spec Ran"]).toBeDefined();
        expect(tableEntries["Spec Ran"].color).toBe(resultColor);
        const parsedSpecRan = tableEntries["Spec Ran"].value.match(
          /^\x1B\[3([12])m(.*)\x1B\[39m\x1B\[3([12])m$/
        );
        expect(parsedSpecRan).not.toBeNull();
        expect((parsedSpecRan as RegExpMatchArray)[1]).toBe(
          resultColor === "red" ? "1" : "2"
        );
        expect((parsedSpecRan as RegExpMatchArray)[2]).toBe(filename);
        expect((parsedSpecRan as RegExpMatchArray)[3]).toBe(
          resultColor === "red" ? "1" : "2"
        );

        Object.keys(tableEntries).forEach((key) =>
          expect([
            "Tests",
            "Passing",
            "Failing",
            "Flaky",
            "Quarantined",
            "Pending",
            "Skipped",
            "Screenshots",
            "Video",
            // Hard to check duration value since we can't easily mock Cypress's clock.
            "Duration",
            "Spec Ran",
          ]).toContain(key)
        );

        return {
          filename,
          reporterOutput: {
            suitesAndTestAttempts,
            ...reporterResults,
          },
          results: {
            color: resultsColor,
            numTests: Number.parseInt(tableEntries["Tests"].value),
            numPassing: Number.parseInt(tableEntries["Passing"].value),
            numFailing: Number.parseInt(tableEntries["Failing"].value),
            numFlaky:
              "Flaky" in tableEntries
                ? Number.parseInt(tableEntries["Flaky"].value)
                : 0,
            numQuarantined:
              "Quarantined" in tableEntries
                ? Number.parseInt(tableEntries["Quarantined"].value)
                : 0,
            numPending: Number.parseInt(tableEntries["Pending"].value),
            numSkipped: Number.parseInt(tableEntries["Skipped"].value),
          },
          lastLineRead:
            specOffset + 2 + resultsLineIndex + 3 + numTableLines + 1,
        };
      } catch (e) {
        throw new Error(`failed to parse spec output for \`${filename}\``, {
          cause: e,
        });
      }
    }
  );

  return {
    linesRead:
      specOutputs.length > 0
        ? specOutputs[specOutputs.length - 1].lastLineRead
        : 0,
    specOutputs: specOutputs.map((specOutput) => ({
      filename: specOutput.filename,
      reporterOutput: specOutput.reporterOutput,
      results: specOutput.results,
    })),
  };
};

const PLUGIN_SUMMARY_TABLE_HEADER_LINE =
  /^\x1B\[90m +\x1B\[39m +\x1B\[90mSpec\x1B\[39m +\x1B\[90mTests\x1B\[39m +\x1B\[90mPassing\x1B\[39m +\x1B\[90mFailing\x1B\[39m +\x1B\[90mFlaky\x1B\[39m +\x1B\[90mQuar\.\x1B\[39m +\x1B\[90mPending\x1B\[39m +\x1B\[90mSkipped\x1B\[39m \x1B\[90m \x1B\[39m$/;

const RUN_FINISHED_LINE =
  "\x1B[0m  (\x1B[4m\x1B[1mRun Finished\x1B[22m\x1B[24m)\x1B[0m";

const parseSummaryTable = (
  _params: TestCaseParams,
  stdoutLinesAfterLastSpecTable: string[]
): Summary => {
  const runFinishedLine = stdoutLinesAfterLastSpecTable.findIndex(
    (line) => line === RUN_FINISHED_LINE
  );
  expect(runFinishedLine).not.toBe(-1);

  expect(stdoutLinesAfterLastSpecTable[runFinishedLine + 3]).toMatch(
    PLUGIN_SUMMARY_TABLE_HEADER_LINE
  );
  expect(stdoutLinesAfterLastSpecTable[runFinishedLine + 4]).toMatch(
    TABLE_TOP_BORDER_LINE
  );
  const numTableLines = stdoutLinesAfterLastSpecTable
    .slice(runFinishedLine + 5)
    .findIndex(TABLE_BOTTOM_BORDER_LINE.test.bind(TABLE_BOTTOM_BORDER_LINE));
  expect(numTableLines).not.toBe(-1);

  const summaryRows = stdoutLinesAfterLastSpecTable
    .slice(runFinishedLine + 5, runFinishedLine + 5 + numTableLines)
    .filter((line) => !TABLE_BETWEEN_ROWS_BORDER_LINE.test(line))
    .map((line): SummaryRow => {
      const parsedRowOrNull = line.match(
        /^\x1B\[90m +│\x1B\[39m \x1B\[3(?:2m(?<iconPass>[✔√])|1m(?<iconFail>[✖×]))\x1B\[39m +\x1B\[0m(?<spec>.+?)\x1B\[0m +\x1B\[90m(?<ms>.+?)\x1B\[39m +\x1B\[(?:0m(?<tests>[0-9]+)\x1B\[0m|90m-\x1B\[39m) +\x1B\[(?:32m(?<passes>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:31m(?<failures>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:33m(?<unquarantinedFlakes>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:35m(?<quarantined>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:36m(?<unquarantinedPending>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:34m(?<skipped>[0-9]+)|90m-)\x1B\[39m \x1B\[90m│\x1B\[39m$/
      );

      expect(
        parsedRowOrNull,
        `invalid summary table row ${JSON.stringify(line)}`
      ).not.toBeNull();
      const parsedRow = parsedRowOrNull as RegExpMatchArray;

      return {
        icon: parsedRow.groups?.iconPass !== undefined ? "pass" : "fail",
        specName: parsedRow.groups?.spec as string,
        numTests:
          parsedRow.groups?.tests !== undefined
            ? Number.parseInt(parsedRow.groups.tests)
            : 0,
        numPassing:
          parsedRow.groups?.passes !== undefined
            ? Number.parseInt(parsedRow.groups.passes)
            : 0,
        numFailing:
          parsedRow.groups?.failures !== undefined
            ? Number.parseInt(parsedRow.groups.failures)
            : 0,
        numFlaky:
          parsedRow.groups?.unquarantinedFlakes !== undefined
            ? Number.parseInt(parsedRow.groups.unquarantinedFlakes)
            : 0,
        numQuarantined:
          parsedRow.groups?.quarantined !== undefined
            ? Number.parseInt(parsedRow.groups.quarantined)
            : 0,
        numPending:
          parsedRow.groups?.unquarantinedPending !== undefined
            ? Number.parseInt(parsedRow.groups.unquarantinedPending)
            : 0,
        numSkipped:
          parsedRow.groups?.skipped !== undefined
            ? Number.parseInt(parsedRow.groups.skipped)
            : 0,
      };
    })
    .sort((a, b) =>
      a.specName < b.specName ? -1 : a.specName > b.specName ? 1 : 0
    );

  const summaryTotalsLine =
    stdoutLinesAfterLastSpecTable[runFinishedLine + 5 + numTableLines + 1];
  const parsedSummaryTotalsOrNull = summaryTotalsLine.match(
    /^\x1B\[90m +\x1B\[39m \x1B\[3(?:2m(?<iconPass>[✔√])|1m(?<iconFail>[✖×]))\x1B\[39m +\x1B\[3(:?2mAll specs passed!|1m(?<descFailed>[0-9]+) of (?<descTotal>[0-9]+) failed \([0-9]+%\))\x1B\[39m +\x1B\[90m(?<ms>.+?)\x1B\[39m +\x1B\[(?:0m(?<tests>[0-9]+)|90m-)\x1B\[0m +\x1B\[(?:32m(?<passes>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:31m(?<failures>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:33m(?<unquarantinedFlakes>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:35m(?<quarantined>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:36m(?<unquarantinedPending>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:34m(?<skipped>[0-9]+)|90m-)\x1B\[39m \x1B\[90m \x1B\[39m$/
  );
  expect(
    parsedSummaryTotalsOrNull,
    `invalid summary table totals ${JSON.stringify(summaryTotalsLine)}`
  ).not.toBeNull();
  const parsedSummaryTotals = parsedSummaryTotalsOrNull as RegExpMatchArray;

  const totals: SummaryTotals = {
    icon: parsedSummaryTotals.groups?.iconPass !== undefined ? "pass" : "fail",
    numTests:
      parsedSummaryTotals.groups?.tests !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.tests)
        : 0,
    numPassing:
      parsedSummaryTotals.groups?.passes !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.passes)
        : 0,
    numFailing:
      parsedSummaryTotals.groups?.failures !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.failures)
        : 0,
    numFlaky:
      parsedSummaryTotals.groups?.unquarantinedFlakes !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.unquarantinedFlakes)
        : 0,
    numQuarantined:
      parsedSummaryTotals.groups?.quarantined !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.quarantined)
        : 0,
    numPending:
      parsedSummaryTotals.groups?.unquarantinedPending !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.unquarantinedPending)
        : 0,
    numSkipped:
      parsedSummaryTotals.groups?.skipped !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.skipped)
        : 0,
  };

  expect(
    parsedSummaryTotals.groups?.descFailed === undefined ? "pass" : "fail"
  ).toBe(totals.icon);
  if (parsedSummaryTotals.groups?.descFailed !== undefined) {
    expect(parsedSummaryTotals.groups.descFailed).toBe(
      summaryRows.filter((row) => row.icon === "fail").length.toString()
    );
    expect(parsedSummaryTotals.groups.descTotal).toBe(
      summaryRows.length.toString()
    );
  }

  return {
    rows: summaryRows,
    totals,
  };
};

const parsePluginDisabledSummaryTable = (
  _params: TestCaseParams,
  stdoutLinesAfterLastSpecTable: string[]
): Summary => {
  const runFinishedLine = stdoutLinesAfterLastSpecTable.findIndex(
    (line) => line === RUN_FINISHED_LINE
  );
  expect(runFinishedLine).not.toBe(-1);

  expect(stdoutLinesAfterLastSpecTable[runFinishedLine + 3]).toMatch(
    /^\x1B\[90m +\x1B\[39m +\x1B\[90mSpec\x1B\[39m +\x1B\[90mTests\x1B\[39m +\x1B\[90mPassing\x1B\[39m +\x1B\[90mFailing\x1B\[39m +\x1B\[90mPending\x1B\[39m +\x1B\[90mSkipped\x1B\[39m \x1B\[90m \x1B\[39m$/
  );
  expect(stdoutLinesAfterLastSpecTable[runFinishedLine + 4]).toMatch(
    TABLE_TOP_BORDER_LINE
  );
  const numTableLines = stdoutLinesAfterLastSpecTable
    .slice(runFinishedLine + 5)
    .findIndex(TABLE_BOTTOM_BORDER_LINE.test.bind(TABLE_BOTTOM_BORDER_LINE));
  expect(numTableLines).not.toBe(-1);

  const summaryRows = stdoutLinesAfterLastSpecTable
    .slice(runFinishedLine + 5, runFinishedLine + 5 + numTableLines)
    .filter((line) => !TABLE_BETWEEN_ROWS_BORDER_LINE.test(line))
    .map((line): SummaryRow => {
      const parsedRowOrNull = line.match(
        /^\x1B\[90m +│\x1B\[39m \x1B\[3(?:2m(?<iconPass>[✔√])|1m(?<iconFail>[✖×]))\x1B\[39m +\x1B\[0m(?<spec>.+?)\x1B\[0m +\x1B\[90m(?<ms>.+?)\x1B\[39m +\x1B\[(?:0m(?<tests>[0-9]+)\x1B\[0m|90m-\x1B\[39m) +\x1B\[(?:32m(?<passes>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:31m(?<failures>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:36m(?<pending>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:[39]4m(?<skipped>[0-9]+)|90m-)\x1B\[39m \x1B\[90m│\x1B\[39m$/
      );

      expect(
        parsedRowOrNull,
        `invalid summary table row ${JSON.stringify(line)}`
      ).not.toBeNull();
      const parsedRow = parsedRowOrNull as RegExpMatchArray;

      return {
        icon: parsedRow.groups?.iconPass !== undefined ? "pass" : "fail",
        specName: parsedRow.groups?.spec as string,
        numTests:
          parsedRow.groups?.tests !== undefined
            ? Number.parseInt(parsedRow.groups.tests)
            : 0,
        numPassing:
          parsedRow.groups?.passes !== undefined
            ? Number.parseInt(parsedRow.groups.passes)
            : 0,
        numFailing:
          parsedRow.groups?.failures !== undefined
            ? Number.parseInt(parsedRow.groups.failures)
            : 0,
        numFlaky: 0,
        numQuarantined: 0,
        numPending:
          parsedRow.groups?.pending !== undefined
            ? Number.parseInt(parsedRow.groups.pending)
            : 0,
        numSkipped:
          parsedRow.groups?.skipped !== undefined
            ? Number.parseInt(parsedRow.groups.skipped)
            : 0,
      };
    })
    .sort((a, b) =>
      a.specName < b.specName ? -1 : a.specName > b.specName ? 1 : 0
    );
  const summaryTotalsLine =
    stdoutLinesAfterLastSpecTable[runFinishedLine + 5 + numTableLines + 1];
  const parsedSummaryTotalsOrNull = summaryTotalsLine.match(
    /^\x1B\[90m +\x1B\[39m \x1B\[3(?:2m(?<iconPass>[✔√])|1m(?<iconFail>[✖×]))\x1B\[39m +\x1B\[3(:?2mAll specs passed!|1m(?<descFailed>[0-9]+) of (?<descTotal>[0-9]+) failed \([0-9]+%\))\x1B\[39m +\x1B\[90m(?<ms>.+?)\x1B\[39m +\x1B\[(?:0m(?<tests>[0-9]+)|90m-)\x1B\[0m +\x1B\[(?:32m(?<passes>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:31m(?<failures>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:36m(?<pending>[0-9]+)|90m-)\x1B\[39m +\x1B\[(?:[39]4m(?<skipped>[0-9]+)|90m-)\x1B\[39m \x1B\[90m \x1B\[39m$/
  );
  expect(
    parsedSummaryTotalsOrNull,
    `invalid summary table totals ${JSON.stringify(summaryTotalsLine)}`
  ).not.toBeNull();
  const parsedSummaryTotals = parsedSummaryTotalsOrNull as RegExpMatchArray;

  const totals: SummaryTotals = {
    icon: parsedSummaryTotals.groups?.iconPass !== undefined ? "pass" : "fail",
    numTests:
      parsedSummaryTotals.groups?.tests !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.tests)
        : 0,
    numPassing:
      parsedSummaryTotals.groups?.passes !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.passes)
        : 0,
    numFailing:
      parsedSummaryTotals.groups?.failures !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.failures)
        : 0,
    numFlaky: 0,
    numQuarantined: 0,
    numPending:
      parsedSummaryTotals.groups?.pending !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.pending)
        : 0,
    numSkipped:
      parsedSummaryTotals.groups?.skipped !== undefined
        ? Number.parseInt(parsedSummaryTotals.groups.skipped)
        : 0,
  };

  expect(
    parsedSummaryTotals.groups?.descFailed === undefined ? "pass" : "fail"
  ).toBe(totals.icon);
  if (parsedSummaryTotals.groups?.descFailed !== undefined) {
    expect(parsedSummaryTotals.groups.descFailed).toBe(
      summaryRows.filter((row) => row.icon === "fail").length.toString()
    );
    expect(parsedSummaryTotals.groups.descTotal).toBe(
      summaryRows.length.toString()
    );
  }

  return {
    rows: summaryRows,
    totals,
  };
};

export const parseOutput = (
  params: TestCaseParams,
  stdoutLines: string[]
): ParsedOutput => {
  const { expectPluginToBeEnabled } = params;

  if (expectPluginToBeEnabled) {
    const { linesRead: linesReadForRunStarting, runStarting } =
      parseRunStarting(params, stdoutLines);

    const { linesRead: linesReadForSpecOutputs, specOutputs } =
      parseSpecOutputs(params, stdoutLines.slice(linesReadForRunStarting));

    const summary = parseSummaryTable(
      params,
      stdoutLines.slice(linesReadForRunStarting + linesReadForSpecOutputs)
    );

    const parsedReport = stdoutLines[stdoutLines.length - 1].match(
      /^Unflakable report: (.*)$/
    );

    return {
      runStarting,
      specOutputs,
      summary,
      unflakableReportUrl: parsedReport !== null ? parsedReport[1] : null,
    };
  } else {
    return {
      runStarting: null,
      specOutputs: [],
      summary: parsePluginDisabledSummaryTable(params, stdoutLines),
      unflakableReportUrl: null,
    };
  }
};
