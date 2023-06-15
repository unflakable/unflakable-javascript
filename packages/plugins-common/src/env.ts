// Copyright (c) 2023 Developer Innovations, LLC

import process from "process";

export class EnvVar {
  private readonly _name: string;

  constructor(name: string) {
    this._name = name;
  }

  get name(): string {
    return this._name;
  }

  get value(): string | undefined {
    return process.env[this.name];
  }

  set value(newValue: string | undefined) {
    process.env[this.name] = newValue;
  }
}

export const branchOverride = new EnvVar("UNFLAKABLE_BRANCH");
export const commitOverride = new EnvVar("UNFLAKABLE_COMMIT");
export const suiteIdOverride = new EnvVar("UNFLAKABLE_SUITE_ID");
export const uploadResultsOverride = new EnvVar("UNFLAKABLE_UPLOAD_RESULTS");
