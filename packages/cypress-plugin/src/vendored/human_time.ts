/*
This file includes portions of a Cypress source code file originally downloaded from:
https://github.com/cypress-io/cypress/blob/d1d15e6cfeb025eeb272015c89d925ff375774c3/packages/server/lib/util/human_time.js
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

import { default as dayjs } from "dayjs";
// File extension required for config-wrapper.ts ESM build.
import duration from "dayjs/plugin/duration.js";

dayjs.extend(duration);

const parse = (ms: number) => {
  const duration = dayjs.duration(ms);
  const hours = duration.hours();
  let mins = hours * 60;

  return {
    mins,
    hours,
    duration,
  };
};

const long = (ms: number, alwaysIncludeSeconds = true): string => {
  let { mins, duration } = parse(ms);
  let word;
  const msg = [];

  mins += duration.minutes();

  if (mins) {
    word = mins === 1 ? "minute" : "minutes";
    msg.push(`${mins} ${word}`);
  }

  const secs = duration.seconds();

  if (alwaysIncludeSeconds || secs > 0) {
    word = secs === 1 ? "second" : "seconds";
    msg.push(`${secs} ${word}`);
  }

  return msg.join(", ");
};

const short = (ms: number): string => {
  let { mins, duration } = parse(ms);
  const msg = [];

  mins += duration.minutes();

  if (mins) {
    msg.push(`${mins}m`);
  }

  const secs = duration.seconds();

  if (secs) {
    msg.push(`${secs}s`);
  } else {
    if (!mins) {
      const millis = duration.milliseconds();

      if (millis) {
        msg.push(`${millis}ms`);
      } else {
        msg.push(`${secs}s`);
      }
    }
  }

  return msg.join(", ");
};

export { long, short };
