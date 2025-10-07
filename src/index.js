const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const { generateMarkdownFromSarif } = require('./generate-report');

function resolvePath(input) {
  if (path.isAbsolute(input)) {
    return input;
  }

  const workspace = process.env.GITHUB_WORKSPACE;
  if (workspace && path.isAbsolute(workspace)) {
    return path.resolve(workspace, input);
  }

  return path.resolve(process.cwd(), input);
}

async function run() {
  try {
    const sarifInput = core.getInput('file-path', { required: true });
    const addSummary = core.getBooleanInput('add-job-summary');

    const sarifPath = resolvePath(sarifInput);

    const sarifRaw = fs.readFileSync(sarifPath, 'utf8');
    const sarif = JSON.parse(sarifRaw);
    const markdown = generateMarkdownFromSarif(sarif, { inputPath: sarifPath });
    core.debug('Markdown report generated successfully.');

    if (addSummary) {
      await core.summary.addRaw(markdown, true).write();
      core.debug('Markdown report appended to the job summary.');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run()