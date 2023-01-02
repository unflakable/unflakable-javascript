// Copyright (c) 2022-2023 Developer Innovations, LLC

export {};

declare global {
  // jest-util references the type Window, which should typecheck as undefined since we don't have
  // the DOM available in Node.
  export type Window = undefined;
}
