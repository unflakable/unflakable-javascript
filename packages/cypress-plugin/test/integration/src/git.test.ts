// Copyright (c) 2023 Developer Innovations, LLC

import { integrationTest, integrationTestSuite } from "./test-wrappers";
import path from "path";

integrationTestSuite(() => {
  it("no git repo", (done) =>
    integrationTest(
      {
        params: {
          expectedBranch: undefined,
          expectedCommit: undefined,
          // Without a repo, paths are relative to the Cypress project root.
          expectedRepoRelativePathPrefix: "",
          git: {
            isRepo: false,
          },
        },
      },
      done
    ));

  // This tests the environment present in GitHub Actions for a `pull_request` event.
  it("git repo with detached HEAD", (done) =>
    integrationTest(
      {
        params: {
          git: {
            abbreviatedRefs: {
              // Mock a detached HEAD.
              HEAD: "HEAD",
              "refs/remote/pull/MOCK_PR_NUMBER/merge":
                "pull/MOCK_PR_NUMBER/merge",
            },
            commit: "MOCK_PR_COMMIT",
            isRepo: true,
            // Mock the `git show-ref` response.
            refs: [
              {
                sha: "MOCK_PR_COMMIT",
                refName: "refs/remote/pull/MOCK_PR_NUMBER/merge",
              },
            ],
            repoRoot: path.resolve("../.."),
          },
          expectedCommit: "MOCK_PR_COMMIT",
          expectedBranch: "pull/MOCK_PR_NUMBER/merge",
        },
      },
      done
    ));

  it("read branch/commit from environment", (done) =>
    integrationTest(
      {
        params: {
          envVars: {
            UNFLAKABLE_BRANCH: "MOCK_BRANCH_ENV",
            UNFLAKABLE_COMMIT: "MOCK_COMMIT_ENV",
          },
          expectedBranch: "MOCK_BRANCH_ENV",
          expectedCommit: "MOCK_COMMIT_ENV",
        },
      },
      done
    ));

  it("read branch/commit from CLI args", (done) =>
    integrationTest(
      {
        params: {
          cliArgs: [
            "--branch",
            "MOCK_BRANCH_CLI",
            "--commit",
            "MOCK_COMMIT_CLI",
          ],
          envVars: {
            UNFLAKABLE_BRANCH: "MOCK_BRANCH_ENV",
            UNFLAKABLE_COMMIT: "MOCK_COMMIT_ENV",
          },
          // CLI should override environment variables.
          expectedBranch: "MOCK_BRANCH_CLI",
          expectedCommit: "MOCK_COMMIT_CLI",
        },
      },
      done
    ));

  it("disable git auto-detection via config", (done) =>
    integrationTest(
      {
        params: {
          config: {
            gitAutoDetect: false,
          },
          expectedBranch: undefined,
          expectedCommit: undefined,
          // Without a repo, paths are relative to the Cypress project root.
          expectedRepoRelativePathPrefix: "",
        },
      },
      done
    ));

  it("disable git auto-detection via CLI", (done) =>
    integrationTest(
      {
        params: {
          cliArgs: ["--no-git-auto-detect"],
          expectedBranch: undefined,
          expectedCommit: undefined,
          // Without a repo, paths are relative to the Cypress project root.
          expectedRepoRelativePathPrefix: "",
        },
      },
      done
    ));
});
