// Copyright (c) 2023 Developer Innovations, LLC

import _debug from "debug";
import { setSimpleGitFactory } from "@unflakable/plugins-common";
import { SimpleGit, TaskOptions, Response as GitResponse } from "simple-git";
import deepEqual from "deep-equal";

const debug = _debug("unflakable:integration-common:git");

export type SimpleGitMockRef = {
  sha: string;
  refName: string;
};
export type SimpleGitMockParams =
  | {
      abbreviatedRefs?: undefined;
      commit?: undefined;
      isRepo: false;
      refs?: undefined;
    }
  | {
      // Maps ref name (e.g., HEAD or refs/remotes/pull/1/merge) to the `git --abbrev-ref <refname>`
      // response (e.g., branch-name, pull/1/merge, or in the case of a detached HEAD, HEAD).
      abbreviatedRefs: { [key in string]: string };
      commit: string;
      isRepo: true;
      refs: SimpleGitMockRef[];
      repoRoot: string;
    };

export const GIT_MOCK_ENV_VAR = "__UNFLAKABLE_TEST_GIT_MOCK_PARAMS";

export const registerSimpleGitMock = (): void => {
  if (process.env[GIT_MOCK_ENV_VAR] === undefined) {
    debug(
      `Not mocking simple-git since ${GIT_MOCK_ENV_VAR} environment variable is not set`
    );
    return;
  }

  const params = JSON.parse(
    process.env[GIT_MOCK_ENV_VAR]
  ) as SimpleGitMockParams;

  debug("Mocking simple-git with params %o", params);

  setSimpleGitFactory(
    () =>
      ({
        checkIsRepo: () =>
          Promise.resolve(params.isRepo) as GitResponse<boolean>,
        revparse: (options: string | TaskOptions) => {
          if (!params.isRepo) {
            throw new Error("not a git repository");
          } else if (
            Array.isArray(options) &&
            options.length === 2 &&
            options[0] === "--abbrev-ref"
          ) {
            return Promise.resolve(
              params.abbreviatedRefs[options[1]] ?? "HEAD"
            ) as GitResponse<string>;
          } else if (
            Array.isArray(options) &&
            options.length === 1 &&
            options[0] === "--show-toplevel"
          ) {
            // Treat the current working directory as the repo root.
            debug(`Returning mock git repo root ${params.repoRoot}`);
            return Promise.resolve(params.repoRoot);
          } else if (options === "HEAD") {
            return Promise.resolve(params.commit) as GitResponse<string>;
          } else {
            throw new Error(`unexpected options ${options.toString()}`);
          }
        },
        raw: (options: string | TaskOptions) => {
          if (!params.isRepo) {
            throw new Error("not a git repository");
          } else if (deepEqual(options, ["show-ref"])) {
            return Promise.resolve(
              (params.refs ?? [])
                .map((mockRef) => `${mockRef.sha} ${mockRef.refName}`)
                .join("\n") + "\n"
            ) as GitResponse<string>;
          } else {
            throw new Error(`unexpected options ${options.toString()}`);
          }
        },
      } as unknown as SimpleGit)
  );
};
