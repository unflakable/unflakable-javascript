// Copyright (c) 2023-2024 Developer Innovations, LLC

export const JS_API_VERSION: string =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require("../package.json") as { version: string }).version;

export const TEST_NAME_ENTRY_MAX_LENGTH = 4096;
