// Copyright (c) 2023 Developer Innovations, LLC

// Make sure expected output is present and chalk-formatted correctly.
import {
  MOCK_RUN_ID,
  specFilename,
  TEST_SPEC_STUBS,
  TestCaseParams,
} from "./run-test-case";
import {
  EMPTY_REPORTER_OUTPUT_MATCH,
  EMPTY_RESULTS,
  NonPassingTestAttempt,
  parseOutput,
  ReporterOutput,
  RunStarting,
  SpecOutput,
  SpecResults,
  SummaryRow,
  SummaryTotals,
} from "./parse-output";
import { expect as expectExt } from "@jest/globals";
import escapeStringRegexp from "escape-string-regexp";
import { TestAttemptResult } from "@unflakable/js-api";

const THROWN_ERROR = "\x1B[0m\x1B[31m     Error\x1B[0m\x1B[90m";
const FAIL_SYMBOL = process.platform === "win32" ? "×" : "✖";
const PASS_SYMBOL = process.platform === "win32" ? "√" : "✓";

const verifySpecOutput = (
  params: TestCaseParams,
  specOutputs: SpecOutput[],
  specNameStub: string,
  expectedReporterOutput: ReporterOutput,
  expectedResults: SpecResults
): void => {
  const { specNameStubs } = params;
  const specOutput = specOutputs.find(
    (spec) => spec.filename === specFilename(params, specNameStub)
  );
  if (specNameStubs === undefined || specNameStubs.includes(specNameStub)) {
    expect(
      specOutput,
      `no output found for spec \`${specNameStub}\``
    ).toBeDefined();
    const spec = specOutput as SpecOutput;
    expect(
      spec.reporterOutput,
      `unexpected reporter output for spec \`${specNameStub}\``
    ).toStrictEqual(expectedReporterOutput);
    expect(
      spec.results,
      `unexpected results for spec \`${specNameStub}\``
    ).toStrictEqual(expectedResults);
  } else {
    expect(
      specOutput,
      `unexpected output found for spec \`${specNameStub}\``
    ).toBeUndefined();
  }
};

const createAttempts = (
  { expectedRetries }: TestCaseParams,
  expectedTitlePath: string[],
  expectedErrorLines: string[]
): NonPassingTestAttempt[] =>
  Array.from({ length: expectedRetries + 1 }, (_, idx) => ({
    titlePath: expectedTitlePath,
    attempt:
      expectedRetries > 0
        ? {
            attemptNum: idx + 1,
            totalAttempts: expectedRetries + 1,
          }
        : undefined,
    errorLines: expectedErrorLines,
  }));

const verifySpecOutputs = (
  params: TestCaseParams,
  specOutputs: SpecOutput[]
): void => {
  const {
    expectPluginToBeEnabled,
    expectQuarantinedTestsToBeQuarantined,
    expectQuarantinedTestsToBeSkipped,
    expectedFlakeTestNameSuffix,
    expectedRetries,
    hookAndTestErrors,
    multipleHookErrors,
    quarantineFlake,
    quarantineHookFail,
    quarantineHookSkip,
    skipFailures,
    skipFlake,
    skipQuarantined,
    skipBeforeHook,
    skipBeforeEachHook,
    skipAfterEachHook,
    skipAfterHook,
  } = params;

  verifySpecOutput(
    params,
    specOutputs,
    "mixed/mixed",
    {
      ...EMPTY_REPORTER_OUTPUT_MATCH,
      suitesAndTestAttempts: [
        "\x1B[0m  spec with mixed test results\x1B[0m",
        ...(!skipQuarantined
          ? expectQuarantinedTestsToBeQuarantined
            ? expectQuarantinedTestsToBeSkipped
              ? [
                  "  \x1B[36m  - mixed: failure should be quarantined\x1B[0m\x1B[35m [quarantined]\x1B[39m",
                  "  \x1B[36m  - mixed: flake should be quarantined\x1B[0m\x1B[35m [quarantined]\x1B[39m",
                ]
              : [
                  ...Array.from(
                    // Last retry has different output.
                    { length: expectedRetries },
                    (_, idx) =>
                      `  \x1B[31m  ${FAIL_SYMBOL} mixed: failure should be quarantined\x1B[0m\x1B[33m (attempt ${
                        idx + 1
                      } of ${expectedRetries + 1})\x1B[0m`
                  ),
                  `  \x1B[35m  ${FAIL_SYMBOL} mixed: failure should be quarantined [failed, quarantined]\x1B[39m${
                    expectedRetries > 0
                      ? `\x1B[33m (attempt ${expectedRetries + 1} of ${
                          expectedRetries + 1
                        })\x1B[0m`
                      : ""
                  }`,
                  ...(expectedRetries > 0
                    ? [
                        `  \x1B[31m  ${FAIL_SYMBOL} mixed: flake should be quarantined\x1B[0m\x1B[33m (attempt 1 of ${
                          expectedRetries + 1
                        })\x1B[0m`,
                        expectExt.stringMatching(
                          new RegExp(
                            // eslint-disable-next-line no-control-regex
                            `^ {2}\x1B\\[35m {2}${PASS_SYMBOL}\x1B\\[39m\x1B\\[90m mixed: flake should be quarantined\x1B\\[0m\x1B\\[35m \\[flaky, quarantined]\x1B\\[39m\x1B\\[33m \\(attempt 2 of ${
                              expectedRetries + 1
                            }\\)\x1B\\[0m\x1B\\[90m \\([0-9]+.+?\\)\x1B\\[0m$`
                          )
                        ),
                      ]
                    : [
                        `  \x1B[35m  ${FAIL_SYMBOL} mixed: flake should be quarantined [failed, quarantined]\x1B[39m`,
                      ]),
                ]
            : [
                ...Array.from(
                  { length: expectedRetries + 1 },
                  (_, idx) =>
                    `  \x1B[31m  ${FAIL_SYMBOL} mixed: failure should be quarantined\x1B[0m${
                      expectedRetries > 0
                        ? `\x1B[33m (attempt ${idx + 1} of ${
                            expectedRetries + 1
                          })\x1B[0m`
                        : ""
                    }`
                ),
                `  \x1B[31m  ${FAIL_SYMBOL} mixed: flake should be quarantined\x1B[0m\x1B[33m (attempt 1 of ${
                  expectedRetries + 1
                })\x1B[0m`,
                expectExt.stringMatching(
                  new RegExp(
                    // eslint-disable-next-line no-control-regex
                    `^ {2}\x1B\\[33m {2}${PASS_SYMBOL}\x1B\\[0m\x1B\\[90m mixed: flake should be quarantined\x1B\\[0m\x1B\\[33m \\[flaky]\x1B\\[0m\x1B\\[33m \\(attempt 2 of ${
                      expectedRetries + 1
                    }\\)\x1B\\[0m\x1B\\[90m \\([0-9]+.+?\\)\x1B\\[0m$`
                  )
                ),
              ]
          : [
              "  \x1B[36m  - mixed: failure should be quarantined\x1B[0m",
              "  \x1B[36m  - mixed: flake should be quarantined\x1B[0m",
            ]),
        ...(!skipFailures
          ? Array.from(
              { length: expectedRetries + 1 },
              (_, idx) =>
                `  \x1B[31m  ${FAIL_SYMBOL} mixed: should fail\x1B[0m${
                  expectedRetries > 0
                    ? `\x1B[33m (attempt ${idx + 1} of ${
                        expectedRetries + 1
                      })\x1B[0m`
                    : ""
                }`
            )
          : ["  \x1B[36m  - mixed: should fail\x1B[0m"]),
        ...(!skipFlake
          ? quarantineFlake &&
            expectQuarantinedTestsToBeQuarantined &&
            expectQuarantinedTestsToBeSkipped
            ? [
                "  \x1B[36m  - mixed: should be flaky\x1B[0m\x1B[35m [quarantined]\x1B[39m",
              ]
            : expectedRetries > 0
            ? [
                `  \x1B[31m  ${FAIL_SYMBOL} mixed: should be flaky\x1B[0m\x1B[33m (attempt 1 of ${
                  expectedRetries + 1
                })\x1B[0m`,
                quarantineFlake && expectQuarantinedTestsToBeQuarantined
                  ? expectExt.stringMatching(
                      new RegExp(
                        // eslint-disable-next-line no-control-regex
                        `^ {2}\x1B\\[35m {2}${PASS_SYMBOL}\x1B\\[39m\x1B\\[90m mixed: should be flaky\x1B\\[0m\x1B\\[35m \\[flaky, quarantined]\x1B\\[39m\x1B\\[33m \\(attempt 2 of ${
                          expectedRetries + 1
                        }\\)\x1B\\[0m\x1B\\[90m \\([0-9]+.+?\\)\x1B\\[0m$`
                      )
                    )
                  : expectExt.stringMatching(
                      new RegExp(
                        // eslint-disable-next-line no-control-regex
                        `^ {2}\x1B\\[33m {2}${PASS_SYMBOL}\x1B\\[0m\x1B\\[90m mixed: should be flaky\x1B\\[0m\x1B\\[33m \\[flaky]\x1B\\[0m\x1B\\[33m \\(attempt 2 of ${
                          expectedRetries + 1
                        }\\)\x1B\\[0m\x1B\\[90m \\([0-9]+.+?\\)\x1B\\[0m$`
                      )
                    ),
              ]
            : [`  \x1B[31m  ${FAIL_SYMBOL} mixed: should be flaky\x1B[0m`]
          : ["  \x1B[36m  - mixed: should be flaky\x1B[0m"]),
        expectExt.stringMatching(
          // eslint-disable-next-line no-control-regex
          new RegExp(
            `^ {2}\\x1B\\[32m {2}${PASS_SYMBOL}\\x1B\\[0m\\x1B\\[90m mixed: should pass\\x1B\\[0m\\x1B\\[90m \\([0-9]+.+?\\)\\x1B\\[0m$`
          )
        ),
        "  \x1B[36m  - mixed: should be skipped\x1B[0m",
      ],
      failures: {
        count:
          (!skipFailures ? 1 : 0) +
          (!skipFlake && expectedRetries === 0 ? 1 : 0) +
          (!skipQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          !expectQuarantinedTestsToBeQuarantined
            ? 1
            : 0),
        tests: [
          ...(!skipQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          !expectQuarantinedTestsToBeQuarantined
            ? [
                {
                  attempts: createAttempts(
                    params,
                    [
                      "spec with mixed test results",
                      "mixed: failure should be quarantined",
                    ],
                    expectExt.arrayContaining([THROWN_ERROR])
                  ),
                },
              ]
            : []),
          ...(!skipFailures
            ? [
                {
                  attempts: createAttempts(
                    params,
                    ["spec with mixed test results", "mixed: should fail"],
                    expectExt.arrayContaining([THROWN_ERROR])
                  ),
                },
              ]
            : []),
          ...(!skipFlake && expectedRetries === 0
            ? [
                {
                  attempts: [
                    {
                      titlePath: [
                        "spec with mixed test results",
                        "mixed: should be flaky",
                      ],
                      attempt: undefined,
                      errorLines: expectExt.arrayContaining([
                        "\x1B[0m\x1B[31m     Error: first try should fail\x1B[0m\x1B[90m",
                      ]),
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      flakes: {
        count:
          (!skipFlake &&
          (!quarantineFlake || !expectQuarantinedTestsToBeQuarantined) &&
          expectedRetries > 0
            ? 1
            : 0) +
          (!skipQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          !expectQuarantinedTestsToBeQuarantined &&
          expectedRetries > 0
            ? 1
            : 0),
        tests: [
          ...(!skipQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          !expectQuarantinedTestsToBeQuarantined &&
          expectedRetries > 0
            ? [
                {
                  attempts: [
                    {
                      titlePath: [
                        "spec with mixed test results",
                        "mixed: flake should be quarantined",
                      ],
                      attempt: {
                        attemptNum: 1,
                        totalAttempts: 2,
                      },
                      errorLines: expectExt.arrayContaining([
                        "\x1B[0m\x1B[31m     Error: first try should fail\x1B[0m\x1B[90m",
                      ]),
                    },
                  ],
                },
              ]
            : []),
          ...(!skipFlake &&
          (!quarantineFlake || !expectQuarantinedTestsToBeQuarantined) &&
          expectedRetries > 0
            ? [
                {
                  attempts: [
                    {
                      titlePath: [
                        "spec with mixed test results",
                        "mixed: should be flaky",
                      ],
                      attempt: {
                        attemptNum: 1,
                        totalAttempts: 2,
                      },
                      errorLines: expectExt.arrayContaining([
                        "\x1B[0m\x1B[31m     Error: first try should fail\x1B[0m\x1B[90m",
                      ]),
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      passing: 1,
      pending:
        1 +
        (!skipFailures ? 0 : 1) +
        (!skipFlake ? 0 : 1) +
        (!skipQuarantined ? 0 : 2),
      quarantinedFailures: {
        count:
          !skipQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          expectQuarantinedTestsToBeQuarantined
            ? 1 + (expectedRetries === 0 ? 1 : 0)
            : 0,
        tests: [
          ...(!skipQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          expectQuarantinedTestsToBeQuarantined
            ? [
                {
                  attempts: createAttempts(
                    params,
                    [
                      "spec with mixed test results",
                      "mixed: failure should be quarantined",
                    ],
                    expectExt.arrayContaining([THROWN_ERROR])
                  ),
                },
                ...(expectedRetries === 0
                  ? [
                      {
                        attempts: [
                          {
                            titlePath: [
                              "spec with mixed test results",
                              "mixed: flake should be quarantined",
                            ],
                            attempt: undefined,
                            errorLines: expectExt.arrayContaining([
                              "\x1B[0m\x1B[31m     Error: first try should fail\x1B[0m\x1B[90m",
                            ]),
                          },
                        ],
                      },
                    ]
                  : []),
              ]
            : []),
        ],
      },
      quarantinedFlakes: {
        count:
          (!skipQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          expectQuarantinedTestsToBeQuarantined &&
          expectedRetries > 0
            ? 1
            : 0) +
          (!skipFlake &&
          quarantineFlake &&
          expectQuarantinedTestsToBeQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          expectedRetries > 0
            ? 1
            : 0),
        tests: [
          ...(!skipQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          expectQuarantinedTestsToBeQuarantined &&
          expectedRetries > 0
            ? [
                {
                  attempts: [
                    {
                      titlePath: [
                        "spec with mixed test results",
                        "mixed: flake should be quarantined",
                      ],
                      attempt: {
                        attemptNum: 1,
                        totalAttempts: 2,
                      },
                      errorLines: expectExt.arrayContaining([
                        "\x1B[0m\x1B[31m     Error: first try should fail\x1B[0m\x1B[90m",
                      ]),
                    },
                  ],
                },
              ]
            : []),
          ...(!skipFlake &&
          quarantineFlake &&
          expectQuarantinedTestsToBeQuarantined &&
          !expectQuarantinedTestsToBeSkipped &&
          expectedRetries > 0
            ? [
                {
                  attempts: [
                    {
                      titlePath: [
                        "spec with mixed test results",
                        "mixed: should be flaky",
                      ],
                      attempt: {
                        attemptNum: 1,
                        totalAttempts: 2,
                      },
                      errorLines: expectExt.arrayContaining([
                        "\x1B[0m\x1B[31m     Error: first try should fail\x1B[0m\x1B[90m",
                      ]),
                    },
                  ],
                },
              ]
            : []),
        ],
      },
      quarantinedPending: {
        count:
          (!skipQuarantined &&
          expectQuarantinedTestsToBeSkipped &&
          expectQuarantinedTestsToBeQuarantined
            ? 2
            : 0) +
          (!skipFlake &&
          quarantineFlake &&
          expectQuarantinedTestsToBeQuarantined &&
          expectQuarantinedTestsToBeSkipped
            ? 1
            : 0),
        tests: [
          ...(!skipQuarantined &&
          expectQuarantinedTestsToBeSkipped &&
          expectQuarantinedTestsToBeQuarantined
            ? [
                {
                  attempts: [
                    {
                      titlePath: [
                        "spec with mixed test results",
                        "mixed: failure should be quarantined",
                      ],
                      attempt: undefined,
                      errorLines: [],
                    },
                  ],
                },
                {
                  attempts: [
                    {
                      titlePath: [
                        "spec with mixed test results",
                        "mixed: flake should be quarantined",
                      ],
                      attempt: undefined,
                      errorLines: [],
                    },
                  ],
                },
              ]
            : []),
          ...(!skipFlake &&
          quarantineFlake &&
          expectQuarantinedTestsToBeQuarantined &&
          expectQuarantinedTestsToBeSkipped
            ? [
                {
                  attempts: [
                    {
                      titlePath: [
                        "spec with mixed test results",
                        "mixed: should be flaky",
                      ],
                      attempt: undefined,
                      errorLines: [],
                    },
                  ],
                },
              ]
            : []),
        ],
      },
    },
    {
      ...EMPTY_RESULTS,
      color:
        skipFailures &&
        (skipFlake ||
          (quarantineFlake && expectQuarantinedTestsToBeQuarantined)) &&
        expectQuarantinedTestsToBeQuarantined
          ? "pass"
          : "fail",
      numTests: 6,
      numFailing:
        // fail
        (!skipFailures ? 1 : 0) +
        // flake
        (!skipFlake &&
        (!expectPluginToBeEnabled ||
          (!quarantineFlake && expectedRetries === 0))
          ? 1
          : 0) +
        // quarantined fail
        (!expectPluginToBeEnabled || !expectQuarantinedTestsToBeQuarantined
          ? 1
          : 0) +
        // quarantined flake
        (!skipFlake &&
        (!expectPluginToBeEnabled ||
          (!expectQuarantinedTestsToBeQuarantined && expectedRetries === 0))
          ? 1
          : 0),
      numFlaky:
        // flake
        (!skipFlake &&
        expectPluginToBeEnabled &&
        (!quarantineFlake || !expectQuarantinedTestsToBeQuarantined) &&
        expectedRetries > 0
          ? 1
          : 0) +
        // quarantined flake
        (!skipFlake &&
        expectPluginToBeEnabled &&
        !expectQuarantinedTestsToBeQuarantined &&
        expectedRetries > 0
          ? 1
          : 0),
      numPassing: 1,
      numPending:
        1 +
        (!skipFailures ? 0 : 1) +
        (!skipFlake ? 0 : 1) +
        (!skipQuarantined ? 0 : 2),
      numQuarantined:
        expectPluginToBeEnabled && expectQuarantinedTestsToBeQuarantined
          ? (!skipQuarantined ? 2 : 0) + (!skipFlake && quarantineFlake ? 1 : 0)
          : 0,
    }
  );

  verifySpecOutput(
    params,
    specOutputs,
    "fail",
    {
      ...EMPTY_REPORTER_OUTPUT_MATCH,
      suitesAndTestAttempts: [
        "\x1B[0m  describe block\x1B[0m",
        ...(!skipFailures
          ? Array.from(
              { length: expectedRetries + 1 },
              (_, idx) =>
                `  \x1B[31m  ${FAIL_SYMBOL} should fail\x1B[0m${
                  expectedRetries > 0
                    ? `\x1B[33m (attempt ${idx + 1} of ${
                        expectedRetries + 1
                      })\x1B[0m`
                    : ""
                }`
            )
          : ["  \x1B[36m  - should fail\x1B[0m"]),
        ...(!skipFailures
          ? Array.from(
              { length: expectedRetries + 1 },
              (_, idx) =>
                `  \x1B[31m  ${FAIL_SYMBOL} should fail with multiple exceptions\x1B[0m${
                  expectedRetries > 0
                    ? `\x1B[33m (attempt ${idx + 1} of ${
                        expectedRetries + 1
                      })\x1B[0m`
                    : ""
                }`
            )
          : ["  \x1B[36m  - should fail with multiple exceptions\x1B[0m"]),
        "\x1B[0m    inner block\x1B[0m",
        ...(!skipFailures
          ? Array.from(
              { length: expectedRetries + 1 },
              (_, idx) =>
                `    \x1B[31m  ${FAIL_SYMBOL} should showDiff\x1B[0m${
                  expectedRetries > 0
                    ? `\x1B[33m (attempt ${idx + 1} of ${
                        expectedRetries + 1
                      })\x1B[0m`
                    : ""
                }`
            )
          : ["    \x1B[36m  - should showDiff\x1B[0m"]),
      ],

      failures: {
        count: !skipFailures ? 3 : 0,
        tests: !skipFailures
          ? [
              {
                attempts: createAttempts(
                  params,
                  ["describe block", "should fail"],
                  expectExt.arrayContaining([THROWN_ERROR])
                ),
              },
              {
                attempts: createAttempts(
                  params,
                  ["describe block", "should fail with multiple exceptions"],
                  expectExt.arrayContaining([
                    "> first",
                    "\x1B[31m     Error: second (and Mocha's done() called multiple times)\x1B[0m\x1B[90m",
                  ])
                ),
              },
              {
                attempts: createAttempts(
                  params,
                  ["describe block", "inner block", "should showDiff"],
                  expectExt.arrayContaining([
                    "\x1B[0m\x1B[31m     AssertionError: expected 'foobar' to equal 'foo'",
                  ])
                ),
              },
            ]
          : [],
      },
      pending: !skipFailures ? 0 : 3,
    },
    {
      ...EMPTY_RESULTS,
      color: skipFailures ? "pass" : "fail",
      numTests: 3,
      numFailing: !skipFailures ? 3 : 0,
      numPending: !skipFailures ? 0 : 3,
    }
  );

  verifySpecOutput(
    params,
    specOutputs,
    "flake",
    {
      ...EMPTY_REPORTER_OUTPUT_MATCH,
      suitesAndTestAttempts:
        !skipFlake &&
        (!quarantineFlake ||
          !expectQuarantinedTestsToBeQuarantined ||
          !expectQuarantinedTestsToBeSkipped)
          ? expectedRetries > 0
            ? [
                `\x1B[31m  ${FAIL_SYMBOL} should be flaky${expectedFlakeTestNameSuffix}\x1B[0m\x1B[33m (attempt 1 of ${
                  expectedRetries + 1
                })\x1B[0m`,
                quarantineFlake && expectQuarantinedTestsToBeQuarantined
                  ? expectExt.stringMatching(
                      new RegExp(
                        // eslint-disable-next-line no-control-regex
                        `^\x1B\\[35m {2}${PASS_SYMBOL}\x1B\\[39m\x1B\\[90m should be flaky${escapeStringRegexp(
                          expectedFlakeTestNameSuffix
                        )}\x1B\\[0m\x1B\\[35m \\[flaky, quarantined]\x1B\\[39m\x1B\\[33m \\(attempt 2 of ${
                          expectedRetries + 1
                        }\\)\x1B\\[0m\x1B\\[90m \\([0-9]+.+?\\)\x1B\\[0m$`
                      )
                    )
                  : expectExt.stringMatching(
                      new RegExp(
                        // eslint-disable-next-line no-control-regex
                        `^\x1B\\[33m {2}${PASS_SYMBOL}\x1B\\[0m\x1B\\[90m should be flaky${escapeStringRegexp(
                          expectedFlakeTestNameSuffix
                        )}\x1B\\[0m\x1B\\[33m \\[flaky]\x1B\\[0m\x1B\\[33m \\(attempt 2 of ${
                          expectedRetries + 1
                        }\\)\x1B\\[0m\x1B\\[90m \\([0-9]+.+?\\)\x1B\\[0m$`
                      )
                    ),
              ]
            : [
                `\x1B[31m  ${FAIL_SYMBOL} should be flaky${expectedFlakeTestNameSuffix}\x1B[0m`,
              ]
          : [
              `\x1B[36m  - should be flaky${expectedFlakeTestNameSuffix}\x1B[0m${
                quarantineFlake &&
                expectQuarantinedTestsToBeSkipped &&
                expectQuarantinedTestsToBeQuarantined
                  ? "\x1B[35m [quarantined]\x1B[39m"
                  : ""
              }`,
            ],
      ...(skipFlake
        ? {
            pending: 1,
          }
        : expectedRetries > 0
        ? {
            [quarantineFlake && expectQuarantinedTestsToBeQuarantined
              ? expectQuarantinedTestsToBeSkipped
                ? "quarantinedPending"
                : "quarantinedFlakes"
              : "flakes"]: {
              count: 1,
              tests: [
                {
                  attempts: [
                    {
                      titlePath: [
                        `should be flaky${expectedFlakeTestNameSuffix}`,
                      ],
                      attempt:
                        !quarantineFlake || !expectQuarantinedTestsToBeSkipped
                          ? {
                              attemptNum: 1,
                              totalAttempts: 2,
                            }
                          : undefined,
                      errorLines:
                        !quarantineFlake || !expectQuarantinedTestsToBeSkipped
                          ? expectExt.arrayContaining([
                              "\x1B[0m\x1B[31m     Error: first try should fail\x1B[0m\x1B[90m",
                            ])
                          : [],
                    },
                  ],
                },
              ],
            },
          }
        : {
            [quarantineFlake && expectQuarantinedTestsToBeQuarantined
              ? "quarantinedFailures"
              : "failures"]: {
              count: 1,
              tests: [
                {
                  attempts: [
                    {
                      titlePath: [
                        `should be flaky${expectedFlakeTestNameSuffix}`,
                      ],
                      attempt: undefined,
                      errorLines: expectExt.arrayContaining([
                        "\x1B[0m\x1B[31m     Error: first try should fail\x1B[0m\x1B[90m",
                      ]),
                    },
                  ],
                },
              ],
            },
          }),
    },
    {
      ...EMPTY_RESULTS,
      color:
        skipFlake || (quarantineFlake && expectQuarantinedTestsToBeQuarantined)
          ? "pass"
          : "fail",
      numTests: 1,
      numFailing:
        !skipFlake &&
        (!quarantineFlake || !expectQuarantinedTestsToBeQuarantined) &&
        expectedRetries === 0
          ? 1
          : 0,
      numFlaky:
        !skipFlake &&
        (!quarantineFlake || !expectQuarantinedTestsToBeQuarantined) &&
        expectedRetries > 0
          ? 1
          : 0,
      numPending: !skipFlake ? 0 : 1,
      numQuarantined:
        !skipFlake && quarantineFlake && expectQuarantinedTestsToBeQuarantined
          ? 1
          : 0,
    }
  );

  const hookFailResult: TestAttemptResult =
    skipBeforeHook &&
    skipBeforeEachHook &&
    skipAfterEachHook &&
    !hookAndTestErrors
      ? "pass"
      : quarantineHookFail
      ? "quarantined"
      : "fail";
  const hookSkipResult: TestAttemptResult | "skip" =
    skipBeforeHook &&
    ((skipBeforeEachHook && skipAfterEachHook) || !skipAfterHook)
      ? skipAfterHook
        ? "pass"
        : quarantineHookSkip
        ? "quarantined"
        : "fail"
      : "skip";

  const hookFailTestFailure = {
    attempts: Array.from(
      {
        length:
          skipBeforeHook &&
          (!skipBeforeEachHook || !skipAfterEachHook || hookAndTestErrors)
            ? expectedRetries + 1
            : 1,
      },
      (_, idx) => ({
        titlePath: ["describe block", "should fail due to hook"],
        attempt:
          skipBeforeHook &&
          (!skipBeforeEachHook || !skipAfterEachHook || hookAndTestErrors)
            ? {
                attemptNum: idx + 1,
                totalAttempts: expectedRetries + 1,
              }
            : undefined,
        errorLines: expectExt.arrayContaining([
          ...(hookAndTestErrors
            ? [
                expectExt.stringMatching(
                  // eslint-disable-next-line no-control-regex
                  /^(?:\x1B\[0m)?\x1B\[31m {5}Error: test error\x1B\[0m\x1B\[90m$/
                ),
              ]
            : []),
          ...(!skipBeforeHook || !skipBeforeEachHook || !skipAfterEachHook
            ? [
                expectExt.stringMatching(
                  new RegExp(
                    `^(?:\x1B\\[0m)?\x1B\\[31m {5}Error: "${
                      !skipBeforeHook
                        ? "before all"
                        : !skipBeforeEachHook
                        ? "before each"
                        : "after each"
                    }" hook failed:$`
                  )
                ),
                expectExt.stringMatching(
                  new RegExp(
                    `^ *> ${
                      !skipBeforeHook
                        ? "before"
                        : !skipBeforeEachHook
                        ? "beforeEach"
                        : "afterEach"
                    } Error #1$`
                  )
                ),
                ...(multipleHookErrors
                  ? [
                      expectExt.stringMatching(
                        new RegExp(
                          `^(?:\x1B\\[31m)?(?: {5})?(?:Error: )?${
                            !skipBeforeHook
                              ? "before"
                              : !skipBeforeEachHook
                              ? "beforeEach"
                              : "afterEach"
                          } Error #2 \\(and Mocha's done\\(\\) called multiple times\\)$`
                        )
                      ),
                    ]
                  : []),
              ]
            : []),
        ]),
      })
    ),
  };
  const hookSkipTestFailure = {
    attempts: [
      {
        titlePath: ["describe block", "should be skipped"],
        attempt: undefined,
        errorLines: expectExt.arrayContaining([
          ...(!skipAfterHook
            ? ['\x1B[0m\x1B[31m     Error: "after all" hook failed:']
            : []),
          `> after Error #1`,
        ]),
      },
    ],
  };

  verifySpecOutput(
    params,
    specOutputs,
    "hook-fail",
    {
      ...EMPTY_REPORTER_OUTPUT_MATCH,
      suitesAndTestAttempts: [
        "\x1B[0m  describe block\x1B[0m",
        ...(hookFailResult === "pass"
          ? [
              expectExt.stringMatching(
                // eslint-disable-next-line no-control-regex
                new RegExp(
                  `^ {2}\\x1B\\[32m {2}${PASS_SYMBOL}\\x1B\\[0m\\x1B\\[90m should fail due to hook\\x1B\\[0m\\x1B\\[90m \\([0-9]+.+?\\)\\x1B\\[0m$`
                )
              ),
            ]
          : Array.from(
              {
                length:
                  skipBeforeHook &&
                  (!skipBeforeEachHook ||
                    !skipAfterEachHook ||
                    hookAndTestErrors)
                    ? expectedRetries + 1
                    : 1,
              },
              (_, idx) =>
                // NB: The default Mocha reporter prints `"<hook-name>" hook for "<test-name>"` as a
                // sort of fake test name, but it uses the same test ID as the associated test.
                // Dealing with multiple names for a single test leads to inconsistencies and also
                // makes it hard to quarantine tests that fail due to hook failures. Instead, we just
                // treat hook failures as failures of the associated test, and Cypress's error
                // message already mentions the hook that failed. See:
                // https://github.com/mochajs/mocha/blob/0be3f78491bbbcdc4dcea660ee7bfd557a225d9c/lib/runner.js#L332
                (hookFailResult === "quarantined" &&
                (!skipBeforeHook || idx === expectedRetries)
                  ? `  \x1B[35m  ${FAIL_SYMBOL} should fail due to hook [failed, quarantined]\x1B[39m`
                  : `  \x1B[31m  ${FAIL_SYMBOL} should fail due to hook\x1B[0m`) +
                (skipBeforeHook && expectedRetries > 0
                  ? `\x1B[33m (attempt ${idx + 1} of ${
                      expectedRetries + 1
                    })\x1B[0m`
                  : "")
            )),
        ...(hookSkipResult === "pass"
          ? [
              expectExt.stringMatching(
                // eslint-disable-next-line no-control-regex
                new RegExp(
                  `^ {2}\\x1B\\[32m {2}${PASS_SYMBOL}\\x1B\\[0m\\x1B\\[90m should be skipped\\x1B\\[0m\\x1B\\[90m \\([0-9]+.+?\\)\\x1B\\[0m$`
                )
              ),
            ]
          : hookSkipResult === "fail"
          ? [`  \x1B[31m  ${FAIL_SYMBOL} should be skipped\x1B[0m`]
          : hookSkipResult === "quarantined"
          ? [
              `  \x1B[35m  ${FAIL_SYMBOL} should be skipped [failed, quarantined]\x1B[39m`,
            ]
          : []),
      ],
      passing:
        (hookFailResult === "pass" ? 1 : 0) +
        (hookSkipResult === "pass" ? 1 : 0),
      failures: {
        count:
          (hookFailResult === "fail" ? 1 : 0) +
          (hookSkipResult === "fail" ? 1 : 0),
        tests: [
          ...(hookFailResult === "fail" ? [hookFailTestFailure] : []),
          ...(hookSkipResult === "fail" ? [hookSkipTestFailure] : []),
        ],
      },
      quarantinedFailures: {
        count:
          (hookFailResult === "quarantined" ? 1 : 0) +
          (hookSkipResult === "quarantined" ? 1 : 0),
        tests: [
          ...(hookFailResult === "quarantined" ? [hookFailTestFailure] : []),
          ...(hookSkipResult === "quarantined" ? [hookSkipTestFailure] : []),
        ],
      },
      skipped: {
        count: hookSkipResult === "skip" ? 1 : 0,
        tests:
          hookSkipResult === "skip"
            ? [
                {
                  titlePath: ["describe block", "should be skipped"],
                  isQuarantined: quarantineHookSkip,
                },
              ]
            : [],
      },
    },
    {
      ...EMPTY_RESULTS,
      color:
        hookFailResult !== "fail" &&
        hookSkipResult !== "fail" &&
        (hookSkipResult !== "skip" || quarantineHookSkip)
          ? "pass"
          : "fail",
      numTests: 2,
      numFailing:
        (hookFailResult === "fail" ? 1 : 0) +
        (hookSkipResult === "fail" ? 1 : 0),
      numPassing:
        (hookFailResult === "pass" ? 1 : 0) +
        (hookSkipResult === "pass" ? 1 : 0),
      numQuarantined:
        (hookFailResult === "quarantined" ? 1 : 0) +
        (hookSkipResult === "quarantined" ? 1 : 0),
      numSkipped: hookSkipResult === "skip" ? 1 : 0,
    }
  );

  verifySpecOutput(
    params,
    specOutputs,
    "invalid",
    {
      ...EMPTY_REPORTER_OUTPUT_MATCH,
      suitesAndTestAttempts: !skipFailures
        ? Array.from(
            { length: expectedRetries + 1 },
            (_, idx) =>
              `\x1B[31m  ${FAIL_SYMBOL} An uncaught error was detected outside of a test\x1B[0m${
                expectedRetries > 0
                  ? `\x1B[33m (attempt ${idx + 1} of ${
                      expectedRetries + 1
                    })\x1B[0m`
                  : ""
              }`
          )
        : [],
      failures: {
        count: !skipFailures ? 1 : 0,
        tests: !skipFailures
          ? [
              {
                attempts: createAttempts(
                  params,
                  ["An uncaught error was detected outside of a test"],
                  expectExt.arrayContaining(["> invalid test file"])
                ),
              },
            ]
          : [],
      },
    },
    {
      ...EMPTY_RESULTS,
      color: skipFailures ? "pass" : "fail",
      numTests: !skipFailures ? 1 : 0,
      numFailing: !skipFailures ? 1 : 0,
    }
  );

  verifySpecOutput(
    params,
    specOutputs,
    "pass",
    {
      ...EMPTY_REPORTER_OUTPUT_MATCH,
      suitesAndTestAttempts: [
        // This gets printed before the test title.
        "called consoleLog command",
        expectExt.stringMatching(
          // eslint-disable-next-line no-control-regex
          new RegExp(
            `^\\x1B\\[32m +${PASS_SYMBOL}\\x1B\\[0m\\x1B\\[90m should pass\\x1B\\[0m\\x1B\\[90m \\([0-9]+.+?\\)\\x1B\\[0m$`
          )
        ),
        "\x1B[0m  suite name\x1B[0m",
        expectExt.stringMatching(
          // eslint-disable-next-line no-control-regex
          new RegExp(
            `^ {2}\\x1B\\[32m {2}${PASS_SYMBOL}\\x1B\\[0m\\x1B\\[90m suite test should pass\\x1B\\[0m\\x1B\\[90m \\([0-9]+.+?\\)\\x1B\\[0m$`
          )
        ),
      ],
      passing: 2,
    },
    {
      ...EMPTY_RESULTS,
      color: "pass",
      numTests: 2,
      numPassing: 2,
    }
  );

  verifySpecOutput(
    params,
    specOutputs,
    "pending",
    {
      ...EMPTY_REPORTER_OUTPUT_MATCH,
      suitesAndTestAttempts: [
        "\x1B[36m  - stub should be pending\x1B[0m",
        "\x1B[36m  - should be pending\x1B[0m",
        "\x1B[0m  suite name\x1B[0m",
        "  \x1B[36m  - suite test should be pending\x1B[0m",
        // NB: Calling it.skip() on a quarantined test with quarantineMode set to skip_tests is
        // indistinguishable from calling it() and having our plugin convert the call to it.skip().
        `  \x1B[36m  - suite test should be quarantined and pending\x1B[0m${
          expectQuarantinedTestsToBeSkipped &&
          expectQuarantinedTestsToBeQuarantined
            ? "\x1B[35m [quarantined]\x1B[39m"
            : ""
        }`,
      ],
      pending:
        !expectQuarantinedTestsToBeSkipped ||
        !expectQuarantinedTestsToBeQuarantined
          ? 4
          : 3,
      quarantinedPending: {
        count:
          !expectQuarantinedTestsToBeSkipped ||
          !expectQuarantinedTestsToBeQuarantined
            ? 0
            : 1,
        tests:
          !expectQuarantinedTestsToBeSkipped ||
          !expectQuarantinedTestsToBeQuarantined
            ? []
            : [
                {
                  attempts: [
                    {
                      titlePath: [
                        "suite name",
                        "suite test should be quarantined and pending",
                      ],
                      attempt: undefined,
                      errorLines: [],
                    },
                  ],
                },
              ],
      },
    },
    {
      ...EMPTY_RESULTS,
      color: "pass",
      numTests: 4,
      numPending:
        !expectQuarantinedTestsToBeSkipped ||
        !expectQuarantinedTestsToBeQuarantined
          ? 4
          : 3,
      numQuarantined:
        !expectQuarantinedTestsToBeSkipped ||
        !expectQuarantinedTestsToBeQuarantined
          ? 0
          : 1,
    }
  );

  verifySpecOutput(
    params,
    specOutputs,
    "quarantined",
    {
      ...EMPTY_REPORTER_OUTPUT_MATCH,
      suitesAndTestAttempts: [
        "\x1B[0m  describe block\x1B[0m",
        ...(!skipQuarantined
          ? expectQuarantinedTestsToBeQuarantined
            ? !expectQuarantinedTestsToBeSkipped
              ? [
                  ...Array.from(
                    // Last retry has different output.
                    { length: expectedRetries },
                    (_, idx) =>
                      `  \x1B[31m  ${FAIL_SYMBOL} should be quarantined\x1B[0m${
                        expectedRetries > 0
                          ? `\x1B[33m (attempt ${idx + 1} of ${
                              expectedRetries + 1
                            })\x1B[0m`
                          : ""
                      }`
                  ),
                  `  \x1B[35m  ${FAIL_SYMBOL} should be quarantined [failed, quarantined]\x1B[39m${
                    expectedRetries > 0
                      ? `\x1B[33m (attempt ${expectedRetries + 1} of ${
                          expectedRetries + 1
                        })\x1B[0m`
                      : ""
                  }`,
                ]
              : [
                  "  \x1B[36m  - should be quarantined\x1B[0m\x1B[35m [quarantined]\x1B[39m",
                ]
            : Array.from(
                { length: expectedRetries + 1 },
                (_, idx) =>
                  `  \x1B[31m  ${FAIL_SYMBOL} should be quarantined\x1B[0m${
                    expectedRetries > 0
                      ? `\x1B[33m (attempt ${idx + 1} of ${
                          expectedRetries + 1
                        })\x1B[0m`
                      : ""
                  }`
              )
          : ["  \x1B[36m  - should be quarantined\x1B[0m"]),
      ],
      ...(skipQuarantined
        ? {
            pending: 1,
          }
        : expectQuarantinedTestsToBeSkipped &&
          expectQuarantinedTestsToBeQuarantined
        ? {
            quarantinedPending: {
              count: 1,
              tests: [
                {
                  attempts: [
                    {
                      titlePath: ["describe block", "should be quarantined"],
                      attempt: undefined,
                      errorLines: [],
                    },
                  ],
                },
              ],
            },
          }
        : {
            [expectQuarantinedTestsToBeQuarantined
              ? "quarantinedFailures"
              : "failures"]: {
              count: 1,
              tests: [
                {
                  attempts: createAttempts(
                    params,
                    ["describe block", "should be quarantined"],
                    expectExt.arrayContaining([THROWN_ERROR])
                  ),
                },
              ],
            },
          }),
    },
    {
      ...EMPTY_RESULTS,
      color:
        skipQuarantined || expectQuarantinedTestsToBeQuarantined
          ? "pass"
          : "fail",
      numTests: 1,
      numPending: skipQuarantined ? 1 : 0,
      numQuarantined:
        skipQuarantined || !expectQuarantinedTestsToBeQuarantined ? 0 : 1,
      numFailing:
        skipQuarantined || expectQuarantinedTestsToBeQuarantined ? 0 : 1,
    }
  );
};

export const verifyOutput = (
  params: TestCaseParams,
  stdoutLines: string[],
  summaryTotals: SummaryTotals,
  apiServerPort: number
): void => {
  const {
    expectPluginToBeEnabled,
    expectQuarantinedTestsToBeQuarantined,
    expectQuarantinedTestsToBeSkipped,
    expectResultsToBeUploaded,
    expectedSuiteId,
    expectedRetries,
    failToUploadResults,
    hookAndTestErrors,
    quarantineFlake,
    quarantineHookFail,
    quarantineHookSkip,
    skipFailures,
    skipFlake,
    skipQuarantined,
    skipBeforeHook,
    skipBeforeEachHook,
    skipAfterEachHook,
    skipAfterHook,
    // hookAndTestErrors,
    // multipleHookErrors,
    specNameStubs,
  } = params;

  // process.stdout.write(
  //   "stdoutLines:\n" +
  //     stdoutLines.map((line) => `${JSON.stringify(line)}`).join(",\n") +
  //     "\n"
  // );

  const parsedOutput = parseOutput(params, stdoutLines);
  // console.log("PARSED OUTPUT", prettyFormat(parsedOutput));

  const expectedSpecs = (specNameStubs ?? TEST_SPEC_STUBS)
    .map((stub) => specFilename(params, stub))
    .sort();

  if (expectPluginToBeEnabled) {
    expect(parsedOutput.runStarting).not.toBeNull();

    expect(
      [...(parsedOutput.runStarting as RunStarting).specs].sort()
    ).toStrictEqual(expectedSpecs);

    // Make sure there are no unexpected specs.
    expect(expectedSpecs).toStrictEqual(
      parsedOutput.specOutputs.map((spec) => spec.filename).sort()
    );

    verifySpecOutputs(params, parsedOutput.specOutputs);
  }

  const summaryRows = expectedSpecs.map((spec): SummaryRow => {
    switch (spec) {
      case specFilename(params, "fail"):
        return {
          icon: !skipFailures ? "fail" : "pass",
          numFailing: !skipFailures ? 3 : 0,
          numFlaky: 0,
          numPassing: 0,
          numPending: !skipFailures ? 0 : 3,
          numQuarantined: 0,
          numSkipped: 0,
          numTests: 3,
          specName: specFilename(params, "fail"),
        };
      case specFilename(params, "flake"):
        return {
          icon: !skipFlake && !quarantineFlake ? "fail" : "pass",
          numFailing:
            !skipFlake &&
            (!expectPluginToBeEnabled ||
              ((!quarantineFlake || !expectQuarantinedTestsToBeQuarantined) &&
                expectedRetries === 0))
              ? 1
              : 0,
          numFlaky:
            !skipFlake &&
            expectPluginToBeEnabled &&
            !quarantineFlake &&
            expectedRetries > 0
              ? 1
              : 0,
          numPassing: 0,
          numPending: !skipFlake ? 0 : 1,
          numQuarantined:
            !skipFlake &&
            expectPluginToBeEnabled &&
            expectQuarantinedTestsToBeQuarantined &&
            quarantineFlake
              ? 1
              : 0,
          numSkipped: 0,
          numTests: 1,
          specName: specFilename(params, "flake"),
        };
      case specFilename(params, "hook-fail"): {
        const hookFailResult: TestAttemptResult =
          skipBeforeHook &&
          skipBeforeEachHook &&
          skipAfterEachHook &&
          !hookAndTestErrors
            ? "pass"
            : quarantineHookFail
            ? "quarantined"
            : "fail";
        const hookSkipResult: TestAttemptResult | "skip" =
          skipBeforeHook &&
          ((skipBeforeEachHook && skipAfterEachHook) || !skipAfterHook)
            ? skipAfterHook
              ? "pass"
              : quarantineHookSkip
              ? "quarantined"
              : "fail"
            : "skip";
        return {
          icon:
            hookFailResult !== "fail" &&
            hookSkipResult !== "fail" &&
            (hookSkipResult !== "skip" || quarantineHookSkip)
              ? "pass"
              : "fail",
          numFailing:
            (hookFailResult === "fail" ? 1 : 0) +
            (hookSkipResult === "fail" ? 1 : 0),
          numFlaky: 0,
          numPassing:
            (hookFailResult === "pass" ? 1 : 0) +
            (hookSkipResult === "pass" ? 1 : 0),
          numPending: 0,
          numQuarantined:
            (hookFailResult === "quarantined" ? 1 : 0) +
            (hookSkipResult === "quarantined" ? 1 : 0),
          numSkipped: hookSkipResult === "skip" ? 1 : 0,
          numTests: 2,
          specName: specFilename(params, "hook-fail"),
        };
      }
      case specFilename(params, "invalid"):
        return {
          icon: !skipFailures ? "fail" : "pass",
          numFailing: !skipFailures ? 1 : 0,
          numFlaky: 0,
          numPassing: 0,
          numPending: 0,
          numQuarantined: 0,
          numSkipped: 0,
          numTests: !skipFailures ? 1 : 0,
          specName: specFilename(params, "invalid"),
        };
      case specFilename(params, "pass"):
        return {
          icon: "pass",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 2,
          numPending: 0,
          numQuarantined: 0,
          numSkipped: 0,
          numTests: 2,
          specName: specFilename(params, "pass"),
        };
      case specFilename(params, "pending"):
        return {
          icon: "pass",
          numFailing: 0,
          numFlaky: 0,
          numPassing: 0,
          numPending:
            !expectQuarantinedTestsToBeSkipped ||
            !expectQuarantinedTestsToBeQuarantined
              ? 4
              : 3,
          numQuarantined:
            !expectQuarantinedTestsToBeSkipped ||
            !expectQuarantinedTestsToBeQuarantined
              ? 0
              : 1,
          numSkipped: 0,
          numTests: 4,
          specName: specFilename(params, "pending"),
        };
      case specFilename(params, "quarantined"):
        return {
          icon:
            expectPluginToBeEnabled && expectQuarantinedTestsToBeQuarantined
              ? "pass"
              : "fail",
          numFailing:
            !skipQuarantined &&
            (!expectPluginToBeEnabled || !expectQuarantinedTestsToBeQuarantined)
              ? 1
              : 0,
          numFlaky: 0,
          numPassing: 0,
          numPending: skipQuarantined ? 1 : 0,
          numQuarantined:
            !skipQuarantined &&
            expectPluginToBeEnabled &&
            expectQuarantinedTestsToBeQuarantined
              ? 1
              : 0,
          numSkipped: 0,
          numTests: 1,
          specName: specFilename(params, "quarantined"),
        };
      case specFilename(params, "mixed/mixed"): {
        const numFailing =
          // fail
          (!skipFailures ? 1 : 0) +
          // flake
          (!skipFlake &&
          (!expectPluginToBeEnabled ||
            (!quarantineFlake && expectedRetries === 0))
            ? 1
            : 0) +
          // quarantined fail
          (!expectPluginToBeEnabled || !expectQuarantinedTestsToBeQuarantined
            ? 1
            : 0) +
          // quarantined flake
          (!skipFlake &&
          (!expectPluginToBeEnabled ||
            (!expectQuarantinedTestsToBeQuarantined && expectedRetries === 0))
            ? 1
            : 0);
        const numFlaky =
          (!skipFlake &&
          expectPluginToBeEnabled &&
          (!quarantineFlake || !expectQuarantinedTestsToBeQuarantined) &&
          expectedRetries > 0
            ? 1
            : 0) +
          (!skipFlake &&
          expectPluginToBeEnabled &&
          !expectQuarantinedTestsToBeQuarantined &&
          expectedRetries > 0
            ? 1
            : 0);
        return {
          icon: numFailing + numFlaky > 0 ? "fail" : "pass",
          numFailing,
          numFlaky,
          numPassing: 1,
          numPending:
            1 +
            (!skipFailures ? 0 : 1) +
            (!skipFlake ? 0 : 1) +
            (!skipQuarantined ? 0 : 2),
          numQuarantined:
            expectPluginToBeEnabled && expectQuarantinedTestsToBeQuarantined
              ? (!skipQuarantined ? 2 : 0) +
                (!skipFlake && quarantineFlake ? 1 : 0)
              : 0,
          numSkipped: 0,
          numTests: 6,
          specName: specFilename(params, "mixed/mixed"),
        };
      }
      default:
        throw new Error(`Unexpected spec ${spec}`);
    }
  });
  expect(parsedOutput.summary).toStrictEqual({
    rows: summaryRows,
    totals: summaryTotals,
  });

  if (
    expectPluginToBeEnabled &&
    expectResultsToBeUploaded &&
    !failToUploadResults
  ) {
    expect(parsedOutput.unflakableReportUrl).toBe(
      `http://localhost:${apiServerPort}/test-suites/${expectedSuiteId}/runs/${MOCK_RUN_ID}`
    );
  } else {
    expect(parsedOutput.unflakableReportUrl).toBeNull();
  }
};
