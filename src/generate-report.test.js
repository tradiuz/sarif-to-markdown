const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { generateMarkdownFromSarif } = require('./generate-report');

test('generateMarkdownFromSarif produces expected markdown snapshot', () => {
  const inputPath = path.join(__dirname, '..', 'test-data', 'qodana.sarif.json');
  const sarif = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  const markdown = generateMarkdownFromSarif(sarif, { inputPath });
  const expectedPath = path.join(__dirname, '..', 'test-data', 'expected-qodana-report.md');
  const expected = fs.readFileSync(expectedPath, 'utf8');

  assert.equal(markdown.trim(), expected.trim());
});
