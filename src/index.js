import { getBooleanInput, getInput, setFailed, setOutput } from "@actions/core";
import { emptyDirSync } from "fs-extra";
import { Notion } from "./notion.js";

async function run() {
  try {
    const notionToken = getInput("notion-token");
    const rootPageId = getInput("root-page-id");
    const outputDir = getInput("output-dir");
    const cleanupBefore = getBooleanInput("cleanup-before") ?? false;

    if (!notionToken) {
      setFailed('"notion-token is required."');
      return;
    }

    if (!rootPageId) {
      setFailed('"root-page-id is required."');
      return;
    }

    if (cleanupBefore) {
      emptyDirSync(outputDir);
    }

    const notion = new Notion(notionToken);
    await notion.outputPages(outputDir, rootPageId);

    setOutput("time", new Date().toTimeString());
  } catch (error) {
    if (error instanceof Error) setFailed(error.message);
  }
}

run();
