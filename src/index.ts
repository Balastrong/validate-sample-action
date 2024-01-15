import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Buffer } from "buffer";
import { HttpClient } from "@actions/http-client";

const http = new HttpClient();

export async function run() {
  const token = getInput("gh-token");

  const octokit = getOctokit(token);
  const pullRequest = context.payload.pull_request;

  try {
    const files = await octokit.rest.pulls
      .listFiles({
        owner: context.repo.owner,
        repo: context.repo.repo,
        pull_number: pullRequest!.number,
        // owner: "kasuken",
        // repo: "TestCustomActionUrl",
        // pull_number: 5,
      })
      .then((files) =>
        files.data.filter((file) => file.filename.endsWith("samples.json"))
      );

    let hasErrors = false;

    const filePromises = files.map(async (file) => {
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

        octokit.rest.issues.createComment({
          issue_number: context.issue.number,
          owner: context.repo.owner,
          repo: context.repo.repo,
          body: `File: ${getFileMarkdownUrl(file.blob_url)}\n${body.errors
            .map((e) => "- " + e)
            .join("\n")}\n`,
        });
      }
    });

    await Promise.all(filePromises);

    if (hasErrors) {
      setFailed("Invalid samples!");
    }
  } catch (error) {
    console.log(error);
    setFailed(error as any);
  }
}

run();

function getFileMarkdownUrl(blobUrl: string) {
  const [first, ...rest] = blobUrl.split("blob/")[1].split("/");
  const name = rest.join("/");

  return `[${name}](${blobUrl})`;
}
