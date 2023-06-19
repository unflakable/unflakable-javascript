/*
This file includes portions of a Cypress source code file originally downloaded from:
https://github.com/cypress-io/cypress/blob/19e091d0bc2d1f4e6a6e62d2f81ea6a2f60d531a/packages/server/lib/util/print-run.ts
Its copyright notice and license are as follows:

  MIT License

  Copyright (c) 2022 Cypress.io

  Permission is hereby granted, free of charge, to any person obtaining a copy
  of this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions:

  The above copyright notice and this permission notice shall be included in all
  copies or substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
  SOFTWARE.


All modifications to the above referenced file are copyrighted and licensed under the terms set
forth in the LICENSE file at the root of this repository.
*/

import _ from "lodash";
import chalk from "chalk";
import * as humanTime from "./human_time";
import * as newlines from "./newlines";
import * as terminal from "./terminal";
import { Cell, default as Table } from "cli-table3";
import logSymbols from "log-symbols";

export type Screenshot = {
  width: number;
  height: number;
  path: string;
  specName: string;
};

export function color(
  val: Cell,
  c: typeof chalk.Color | typeof chalk.Modifiers
): string {
  return chalk[c](val);
}

export function gray(val: string): string {
  return color(val, "gray");
}

export function colorIf(
  val: Cell,
  c: typeof chalk.Color | typeof chalk.Modifiers
): string {
  if (val === 0 || val == null) {
    val = "-";
    c = "gray";
  }

  return color(val, c);
}

export function getWidth(table: Table.Table, index: number): number {
  // get the true width of a table's column,
  // based off of calculated table options for that column
  const columnWidth = table.options.colWidths[index];

  if (columnWidth) {
    return (
      columnWidth -
      (table.options.style["padding-left"] +
        table.options.style["padding-right"])
    );
  }

  throw new Error("Unable to get width for column");
}

function formatBrowser(browser: Cypress.Browser) {
  return _.compact([
    browser.displayName,
    browser.majorVersion,
    browser.isHeadless && gray("(headless)"),
  ]).join(" ");
}

export function formatSymbolSummary(failures: number): string {
  return failures ? logSymbols.error : logSymbols.success;
}

function macOSRemovePrivate(str: string) {
  // consistent snapshots when running system tests on macOS
  if (process.platform === "darwin" && str.startsWith("/private")) {
    return str.slice(8);
  }

  return str;
}

export function formatPath(
  name: string,
  n: number | undefined,
  pathColor: typeof chalk.Color | typeof chalk.Modifiers = "reset"
): string {
  if (!name) return "";

  const fakeCwdPath = process.env.FAKE_CWD_PATH;

  if (fakeCwdPath && process.env.CYPRESS_INTERNAL_ENV === "test") {
    // if we're testing within Cypress, we want to strip out
    // the current working directory before calculating the stdout tables
    // this will keep our snapshots consistent everytime we run
    const cwdPath = process.cwd();

    name = name.split(cwdPath).join(fakeCwdPath);

    name = macOSRemovePrivate(name);
  }

  // add newLines at each n char and colorize the path
  if (n) {
    let nameWithNewLines = newlines.addNewlineAtEveryNChar(name, n);

    return `${color(nameWithNewLines, pathColor)}`;
  }

  return `${color(name, pathColor)}`;
}

function formatNodeVersion(
  {
    resolvedNodeVersion,
    resolvedNodePath,
  }: Pick<
    Cypress.ResolvedConfigOptions,
    "resolvedNodeVersion" | "resolvedNodePath"
  >,
  width: number
) {
  if (resolvedNodePath)
    return formatPath(
      `v${resolvedNodeVersion} ${gray(`(${resolvedNodePath})`)}`,
      width
    );

  return;
}

function formatRecordParams(
  runUrl?: string,
  parallel?: boolean,
  group?: string,
  tag?: string,
  autoCancelAfterFailures?: number | false
) {
  if (runUrl) {
    return `Tag: ${tag || "false"}, Group: ${
      group || "false"
    }, Parallel: ${Boolean(parallel)}${
      autoCancelAfterFailures !== undefined
        ? `, Auto Cancel After Failures: ${autoCancelAfterFailures}`
        : ""
    }`;
  }

  return;
}

export function displayRunStarting(options: {
  browser: Cypress.Browser;
  config: Pick<Cypress.RuntimeConfigOptions, "version"> &
    Pick<
      Cypress.ResolvedConfigOptions,
      "resolvedNodeVersion" | "resolvedNodePath"
    >;
  group: string | undefined;
  parallel?: boolean;
  runUrl?: string;
  specPattern: string | RegExp | string[];
  specs: CypressCommandLine.RunResult["spec"][];
  tag: string | undefined;
  autoCancelAfterFailures?: number | false;
}): string {
  const {
    browser,
    config,
    group,
    parallel,
    runUrl,
    specPattern,
    specs,
    tag,
    autoCancelAfterFailures,
  } = options;

  console.log("");

  terminal.divider("=");

  console.log("");

  terminal.header("Run Starting", {
    color: ["reset"],
  });

  console.log("");

  // NB: We don't vendor the experiments module because it changes too frequently for us to stay on
  // top of upstream changes, and it may not work consistently with different Cypress versions.
  /*
  const experimental = experiments.getExperimentsFromResolved(config.resolved);
  const enabledExperiments = _.pickBy(experimental, _.property("enabled"));
  const hasExperiments =
    !process.env.CYPRESS_INTERNAL_SKIP_EXPERIMENT_LOGS &&
    !_.isEmpty(enabledExperiments);
   */

  // if we show Node Version, then increase 1st column width
  // to include wider 'Node Version:'.
  // Without Node version, need to account for possible "Experiments" label
  const colWidths = config.resolvedNodePath
    ? [16, 84]
    : /*: hasExperiments
    ? [14, 86]*/
      [12, 88];

  const table = terminal.table({
    colWidths,
    type: "outsideBorder",
  });

  if (!specPattern) throw new Error("No specPattern in displayRunStarting");

  const formatSpecs = (specs: CypressCommandLine.RunResult["spec"][]) => {
    // 25 found: (foo.spec.js, bar.spec.js, baz.spec.js)
    const names = _.map(specs, "relativeToCommonRoot");
    const specsTruncated = _.truncate(names.join(", "), { length: 250 });

    const stringifiedSpecs = [
      `${names.length} found `,
      "(",
      specsTruncated,
      ")",
    ].join("");

    return formatPath(stringifiedSpecs, getWidth(table, 1));
  };

  const data = _.chain([
    [gray("Cypress:"), config.version],
    [gray("Browser:"), formatBrowser(browser)],
    [gray("Node Version:"), formatNodeVersion(config, getWidth(table, 1))],
    [gray("Specs:"), formatSpecs(specs)],
    [
      gray("Searched:"),
      formatPath(
        Array.isArray(specPattern)
          ? specPattern.join(", ")
          : String(specPattern),
        getWidth(table, 1)
      ),
    ],
    [
      gray("Params:"),
      formatRecordParams(runUrl, parallel, group, tag, autoCancelAfterFailures),
    ],
    [gray("Run URL:"), runUrl ? formatPath(runUrl, getWidth(table, 1)) : ""],
    /*[
      gray("Experiments:"),
      hasExperiments ? experiments.formatExperiments(enabledExperiments) : "",
    ],*/
  ])
    .filter(_.property(1))
    .value();

  table.push(...data);

  const heading = table.toString();

  console.log(heading);

  console.log("");

  return heading;
}

export function displaySpecHeader(
  name: string,
  curr: number,
  total: number,
  estimated: number
): void {
  console.log("");

  const PADDING = 2;

  const table = terminal.table({
    colWidths: [10, 70, 20],
    colAligns: ["left", "left", "right"],
    type: "pageDivider",
    style: {
      "padding-left": PADDING,
      "padding-right": 0,
    },
  });

  table.push(["", ""]);
  table.push([
    "Running:",
    `${formatPath(name, getWidth(table, 1), "gray")}`,
    gray(`(${curr} of ${total})`),
  ]);

  console.log(table.toString());

  if (estimated) {
    const estimatedLabel = `${" ".repeat(PADDING)}Estimated:`;

    return console.log(estimatedLabel, gray(humanTime.long(estimated)));
  }
}

export function displayScreenshots(screenshots: Screenshot[] = []): void {
  console.log("");

  terminal.header("Screenshots", { color: ["yellow"] });

  console.log("");

  const table = terminal.table({
    colWidths: [3, 82, 15],
    colAligns: ["left", "left", "right"],
    type: "noBorder",
    style: {
      "padding-right": 0,
    },
    chars: {
      left: " ",
      right: "",
    },
  });

  screenshots.forEach((screenshot) => {
    const dimensions = gray(`(${screenshot.width}x${screenshot.height})`);

    table.push([
      "-",
      formatPath(`${screenshot.path}`, getWidth(table, 1)),
      gray(dimensions),
    ]);
  });

  console.log(table.toString());

  console.log("");
}
