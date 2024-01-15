import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Buffer } from "buffer";
import { HttpClient } from "@actions/http-client";

export async function run() {
  const token = getInput("gh-token");

  const octokit = getOctokit(token);
  const pullRequest = context.payload.pull_request;

  const http = new HttpClient();

  try {
    // get all files in the PR
    const files = await octokit.rest.pulls
      .listFiles({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pullRequest!.number,
        // owner: "kasuken",
        // repo: "TestCustomActionUrl",
        // pull_number: 4,
      })
      .then((files) =>
        files.data.filter((file) => file.filename.endsWith("samples.json"))
      );

    let hasErrors = false;

    files.forEach(async (file) => {
      const fileData = await octokit.request(file.contents_url);
      const fileContent = Buffer.from(
        fileData.data.content,
        "base64"
      ).toString();

      const res = await http.post(
        "https://m365-galleries-test.azurewebsites.net/Samples/validateSample",
        fileContent,
        {
          "Content-Type": "application/json",
        }
      );

      const body = JSON.parse(await res.readBody()) as {
        isValid: boolean;
        errors: string[];
      };

      if (!body.isValid) {
        hasErrors = true;
        body.errors.forEach((error) => console.log(error));

        octokit.rest.issues.createComment({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          body: `File: ${file.raw_url}\n${body.errors
            .map((e) => "- " + e)
            .join("\n")}\n`,
        });
      }
    });

    if (hasErrors) {
      setFailed("Invalid samples");
    }
  } catch (error) {
    console.log(error);
    setFailed(error as any);
  }
}

run();
