// Copyright (c) 2022-2023 Developer Innovations, LLC

import type { SimpleGit } from "simple-git";
import { debug as _debug } from "debug";

const debug = _debug("unflakable:git");

export const getCurrentGitBranch = async (
  git: SimpleGit,
  commitSha: string
): Promise<string | undefined> => {
  // In the common case (an attached HEAD), we can just use `git rev-parse`.
  const headRef = await git.revparse(["--abbrev-ref", "HEAD"]);

  // If `git rev-parse` returns `HEAD`, then we have a detached head, and we need to see if the
  // current commit SHA matches any known refs (i.e., local/remote branches or tags). This happens
  // when running GitHub Actions in response to a `pull_request` event. In that case, the commit
  // is a detached HEAD, but there's a `refs/remotes/pull/PR_NUMBER/merge` ref we can use as the
  // "branch" (abbreviated to pull/PR_NUMBER/merge).
  if (headRef !== "HEAD") {
    return headRef;
  }

  // The code below runs the equivalent of `git show-ref | grep $(git rev-parse HEAD)`.
  const gitOutput = await git.raw(["show-ref"]);
  const matchingRefs = gitOutput
    .split("\n")
    .map((line) => {
      const [sha, refName] = line.split(" ", 2);
      return {
        sha,
        refName,
      };
    })
    .filter(({ sha }) => sha === commitSha);
  debug(
    `git show-ref returned ${
      matchingRefs.length
    } ref(s) SHA ${commitSha}: ${matchingRefs
      .map((ref) => ref.refName)
      .join(", ")}`
  );

  if (matchingRefs.length === 0) {
    return undefined;
  }

  // `git show-ref` returns refs sorted lexicographically:
  //   refs/heads/*
  //   refs/remotes/*
  //   refs/stash
  //   refs/tags/*
  // We just take the first matching ref and use its abbreviation (i.e., removing the refs/remotes
  // prefix) as the branch name. Users can override this behavior by setting the UNFLAKABLE_BRANCH
  // environment variable.
  return git.revparse(["--abbrev-ref", matchingRefs[0].refName]);
};

export const getCurrentGitCommit = (git: SimpleGit): Promise<string> =>
  git.revparse("HEAD");
