// Copyright (c) 2022-2023 Developer Innovations, LLC

import path from "path";
import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";

integrationTestSuite((mockBackend) => {
  it("no git repo", (done) =>
    integrationTest(
      {
        params: {
          expectedBranch: undefined,
          expectedCommit: undefined,
          // Without a repo, paths are relative to the Jest rootDir.
          expectedRepoRelativePathPrefix: "",
          git: {
            isRepo: false,
          },
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
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
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));

  it("read branch/commit from environment", (done) =>
    integrationTest(
      {
        params: {
          envVars: {
            UNFLAKABLE_BRANCH: "MOCK_BRANCH2",
            UNFLAKABLE_COMMIT: "MOCK_COMMIT2",
          },
          expectedBranch: "MOCK_BRANCH2",
          expectedCommit: "MOCK_COMMIT2",
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));

  it("disable git auto-detection", (done) =>
    integrationTest(
      {
        params: {
          config: {
            gitAutoDetect: false,
          },
          expectedBranch: undefined,
          expectedCommit: undefined,
          // Without a repo, paths are relative to the Jest rootDir.
          expectedRepoRelativePathPrefix: "",
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    ));
});
