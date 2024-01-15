import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";

export async function run() {
  const token = getInput("gh-token");

  const octokit = getOctokit(token);
  const pullRequest = context.payload.pull_request;

  try {
    // get all files in the PR
    const files = await octokit.rest.pulls.listFiles({
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pullRequest!.number,
    });

    files.data.forEach((file) => {
      console.log(file);
    });
  } catch (error) {
    setFailed((error as Error)?.message);
  }
}

run();
