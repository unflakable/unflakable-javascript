/*
This file includes portions of a Cypress source code file originally downloaded from:
https://github.com/cypress-io/cypress/blob/19e091d0bc2d1f4e6a6e62d2f81ea6a2f60d531a/packages/server/lib/util/terminal.js
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
import { default as Table } from "cli-table3";
// File extension required for config-wrapper.ts ESM build.
import utils from "cli-table3/src/utils.js";
import widestLine from "widest-line";
import * as terminalSize from "./terminal-size";

const MAXIMUM_SIZE = 100;
const EXPECTED_SUM = 100;

const getMaximumColumns = (): number => {
  // get the maximum amount of columns
  // that can fit in the terminal
  return Math.min(MAXIMUM_SIZE, terminalSize.get().columns);
};

const getBordersLength = (left: string, right: string): number => {
  return _.chain([left, right]).compact().map(widestLine).sum().value();
};

const renderTables = (...tables: Table.Table[]): string => {
  return _.chain([] as Table.Table[])
    .concat(tables)
    .invokeMap("toString")
    .join("\n")
    .value();
};

export type TableType =
  | "border"
  | "noBorder"
  | "outsideBorder"
  | "pageDivider"
  | "allBorders";

const getChars = (type: TableType): Table.TableConstructorOptions["chars"] => {
  switch (type) {
    case "border":
      return {
        "top-mid": "",
        "top-left": "  ┌",
        left: "  │",
        "left-mid": "  ├",
        middle: "",
        "mid-mid": "",
        right: "│",
        "bottom-mid": "",
        "bottom-left": "  └",
      };
    case "noBorder":
      return {
        top: "",
        "top-mid": "",
        "top-left": "",
        "top-right": "",
        left: "   ",
        "left-mid": "",
        middle: "",
        mid: "",
        "mid-mid": "",
        right: " ",
        "right-mid": "",
        bottom: "",
        "bottom-left": "",
        "bottom-mid": "",
        "bottom-right": "",
      };
    case "outsideBorder":
      return {
        // "top": ""
        "top-left": "  ┌",
        "top-mid": "",
        left: "  │",
        "left-mid": "",
        middle: "",
        mid: "",
        "mid-mid": "",
        "right-mid": "",
        "bottom-mid": "",
        "bottom-left": "  └",
      };
    case "pageDivider":
      return {
        top: "─",
        "top-mid": "",
        "top-left": "",
        "top-right": "",
        bottom: "",
        "bottom-mid": "",
        "bottom-left": "",
        "bottom-right": "",
        left: "",
        "left-mid": "",
        mid: "",
        "mid-mid": "",
        right: "",
        "right-mid": "",
        middle: "",
      };
    case "allBorders":
      return {
        // this is default from cli-table mostly just for debugging,
        // if you want to see where borders would be drawn
        top: "─",
        "top-mid": "┬",
        "top-left": "┌",
        "top-right": "┐",
        bottom: "─",
        "bottom-mid": "┴",
        "bottom-left": "└",
        "bottom-right": "┘",
        left: "│",
        "left-mid": "├",
        mid: "─",
        "mid-mid": "┼",
        right: "│",
        "right-mid": "┤",
        middle: "│",
      };
    default:
      throw new Error(`Table chars type: "${type}" is not supported`);
  }
};

const wrapBordersInGray = (
  chars: Table.TableConstructorOptions["chars"]
): Table.TableConstructorOptions["chars"] => {
  return _.mapValues(chars, (char) => {
    if (char) {
      return chalk.gray(char);
    }

    return char;
  });
};

const table = (
  options: Table.TableConstructorOptions & { type: TableType }
): Table.HorizontalTable => {
  const { type } = options;
  const defaults = utils.mergeOptions({});

  let { colWidths } = options;
  let chars = _.defaults(getChars(type), defaults.chars);

  _.defaultsDeep(options, {
    chars,
    style: {
      head: [],
      border: [],
      "padding-left": 1,
      "padding-right": 1,
    },
  });

  chars = options.chars as NonNullable<Table.TableConstructorOptions["chars"]>;

  if (colWidths) {
    const sum = _.sum(colWidths);

    if (sum !== EXPECTED_SUM) {
      throw new Error(
        `Expected colWidths array to sum to: ${EXPECTED_SUM}, instead got: ${sum}`
      );
    }

    const bordersLength = getBordersLength(
      chars.left as string,
      chars.right as string
    );

    if (bordersLength > 0) {
      // redistribute the columns to account for borders on each side...
      // and subtract  borders size from the largest width cell
      const largestCellWidth = _.max(colWidths) as number;

      const index = _.indexOf(colWidths, largestCellWidth);

      colWidths = _.clone(colWidths);

      colWidths[index] = largestCellWidth - bordersLength;
      options.colWidths = colWidths;
    }
  }

  options.chars = wrapBordersInGray(chars);

  return new Table(options) as Table.HorizontalTable;
};

const header = (
  message: string,
  options: {
    color?: (typeof chalk.Color | typeof chalk.Modifiers)[];
  } = {}
): void => {
  _.defaults(options, {
    color: null,
  });

  message = `  (${chalk.underline.bold(message)})`;

  if (options.color) {
    const colors = (
      [] as (typeof chalk.Color | typeof chalk.Modifiers)[]
    ).concat(options.color);

    message = _.reduce(
      colors,
      (memo, color) => {
        return chalk[color](memo);
      },
      message
    );
  }

  console.log(message); // eslint-disable-line no-console
};

const divider = (symbol: string, color: typeof chalk.Color = "gray"): void => {
  const cols = getMaximumColumns();
  const str = symbol.repeat(cols);

  console.log(chalk[color](str)); // eslint-disable-line no-console
};

export { table, header, divider, renderTables, getMaximumColumns };
