/*
This file includes portions of a Cypress source code file originally downloaded from:
https://github.com/cypress-io/cypress/blob/d1d15e6cfeb025eeb272015c89d925ff375774c3/packages/server/lib/util/duration.js
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
import { default as dayjs } from "dayjs";
// File extensions required for config-wrapper.ts ESM build.
import duration from "dayjs/plugin/duration.js";
import relativeTime from "dayjs/plugin/relativeTime.js";
import updateLocale from "dayjs/plugin/updateLocale.js";

dayjs.extend(duration);
dayjs.extend(relativeTime);
dayjs.extend(updateLocale);
dayjs.updateLocale("en", {
  relativeTime: {
    future: "in %s",
    past: "%s ago",
    s: "a few secs",
    ss: "%d secs",
    m: "a min",
    mm: "%d mins",
    h: "an hour",
    hh: "%d hours",
    d: "a day",
    dd: "%d days",
    M: "a month",
    MM: "%d months",
    y: "a year",
    yy: "%d years",
  },
});

const format = (durationInMs: number, padMinutes = true): string => {
  const duration = dayjs.duration(durationInMs);

  const durationSecs = duration.seconds() ? `${duration.seconds()}` : "";
  const durationMins = duration.minutes() ? `${duration.minutes()}` : "";
  const durationHrs = duration.hours() ? `${duration.hours()}` : "";

  const total = _.compact([
    durationHrs,
    durationHrs !== "" || padMinutes
      ? _.padStart(durationMins, 2, "0")
      : durationMins,
    _.padStart(durationSecs, 2, "0"),
  ]);

  const totalMinSec = total.join(":");

  if (totalMinSec === "00:00") {
    return `${duration.milliseconds()}ms`;
  }

  return totalMinSec;
};

export { format };
