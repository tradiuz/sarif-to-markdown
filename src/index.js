const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const { generateMarkdownFromSarif } = require('./generate-report');

function resolvePathMaybe(input) {
  if (path.isAbsolute(input)) {
    return input;
  }

  const workspace = process.env.GITHUB_WORKSPACE;
  if (workspace && path.isAbsolute(workspace)) {
    return path.resolve(workspace, input);
  }

  return path.resolve(process.cwd(), input);
}

async function run({ coreApi = core } = {}) {
  try {
    const sarifInput = coreApi.getInput('file-path', { required: true });
    const addSummary = coreApi.getBooleanInput('add-job-summary');

    const sarifPath = resolvePathMaybe(sarifInput);

    const sarifRaw = fs.readFileSync(sarifPath, 'utf8');
    const sarif = JSON.parse(sarifRaw);
    const markdown = generateMarkdownFromSarif(sarif, { inputPath: sarifPath });
    coreApi.debug('Markdown report generated successfully.');

    if (addSummary) {
      await coreApi.summary.addRaw(markdown, true).write();
      coreApi.debug('Markdown report appended to the job summary.');
    }
  } catch (error) {
    coreApi.setFailed(error.message);
  }
}

run()