const fs = require('fs');
const path = require('path');
const core = require('@actions/core');
const { generateMarkdownFromSarif } = require('./generate-report');

function resolvePathMaybe(input) {
  if (!input) {
    return undefined;
  }

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
    const outputPathInput = core.getInput('output-markdown');
    const addSummary = core.getBooleanInput('add-job-summary');

    const sarifPath = resolvePathMaybe(sarifInput);
    const outputPath = resolvePathMaybe(outputPathInput);

    const sarifRaw = fs.readFileSync(sarifPath, 'utf8');
    const sarif = JSON.parse(sarifRaw);
    const markdown = generateMarkdownFromSarif(sarif, { inputPath: sarifPath });

    if (outputPath) {
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });
      fs.writeFileSync(outputPath, markdown, 'utf8');
      core.info(`Markdown report written to ${outputPath}`);
      core.setOutput('markdown-file', outputPath);
    }

    core.setOutput('markdown', markdown);

    if (addSummary) {
      await core.summary.addRaw(markdown, true).write();
      core.info('Markdown report appended to the job summary.');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

if (require.main === module) {
  run();
}

module.exports = run;
