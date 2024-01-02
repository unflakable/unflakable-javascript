// Copyright (c) 2023-2024 Developer Innovations, LLC

// Jest changes FORCE_COLOR to 1 when it forks child processes. We execute this script with
// `node --require` so that each subprocess has the correct FORCE_COLOR value to produce the color
// output required by the tests. Fortunately, Jest propagates `process.execArgv` to child processes,
// which includes our --require arg. See:
// https://github.com/jestjs/jest/blob/5d1e98beda19dcfff3f10557396098524efbb639/packages/jest-worker/src/workers/ChildProcessWorker.ts#L89

process.env.FORCE_COLOR = "3";
