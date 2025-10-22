#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const UNCATEGORIZED_ID = '__UNCATEGORIZED__';
const SEVERITY_ORDER = Object.freeze([
  'Critical',
  'High',
  'Moderate',
  'Medium',
  'Low',
  'Note',
  'Warning',
  'Error',
  'Info',
  'Information',
  'Unknown',
]);

const readSarif = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to read SARIF input at ${filePath}: ${error.message}`);
  }
};

const toTitleCase = (value) => {
  if (!value) {
    return '';
  }
  const str = String(value);
  return `${str.charAt(0).toUpperCase()}${str.slice(1).toLowerCase()}`;
};

const harvestRuleIndex = (run) => {
  const ruleIndex = new Map();
  const driverRules = Array.isArray(run?.tool?.driver?.rules)
    ? run.tool.driver.rules
    : [];

  for (const rule of driverRules) {
    const categories = Array.isArray(rule.relationships)
      ? rule.relationships
        .map((relationship) => relationship?.target?.id || relationship?.target?.guid)
        .filter(Boolean)
      : [];

    ruleIndex.set(rule.id, {
      id: rule.id,
      shortDescription: rule.shortDescription?.text,
      fullDescription: rule.fullDescription?.text,
      helpUri: rule.helpUri || rule.help?.text,
      defaultLevel: rule.defaultConfiguration?.level,
      categories,
    });
  }

  return ruleIndex;
};

const normalizeSeverity = (result, ruleInfo) => {
  const severity = result?.properties?.qodanaSeverity
    || result?.level
    || ruleInfo?.defaultLevel;

  return severity ? toTitleCase(severity) : 'Unknown';
};

const escapeHtml = (text) => {
  if (text === null || text === undefined) {
    return '';
  }
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
};

const escapeTableCell = (text) => {
  if (text === null || text === undefined) {
    return '';
  }
  return String(text)
    .replace(/\r?\n/g, '<br>')
    .replace(/\|/g, '\\|')
    .replace(/(?!<\s*br\s*\/*\s*>)(<)/gi, '&lt;')
    .replace(/(>)(?<!<\s*br\s*\/*\s*>)/gi, '&gt;');
};

const humanizeCategoryId = (categoryId) => {
  if (!categoryId || categoryId === UNCATEGORIZED_ID) {
    return 'Uncategorized';
  }

  const transforms = {
    CSHARP: 'C#',
    VBNET: 'VB.NET',
    FSHARP: 'F#',
    JAVASCRIPT: 'JavaScript',
    TYPESCRIPT: 'TypeScript',
    CPP: 'C++',
    CS: 'C#',
  };

  return String(categoryId)
    .split('.')
    .map((part) => {
      const upper = part.toUpperCase();
      if (transforms[upper]) {
        return transforms[upper];
      }

      return part
        .replace(/_/g, ' ')
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    })
    .join(' › ');
};

const formatLocation = (location) => {
  if (!location?.physicalLocation) {
    return 'Unknown location';
  }

  const artifact = location.physicalLocation.artifactLocation || {};
  const region = location.physicalLocation.region || {};
  const file = artifact.uri || 'Unknown file';
  const { startLine } = region;

  return startLine ? `${file}:${startLine}` : file;
};

const collectResults = (runs) => {
  const summaryCounts = new Map();
  const categories = new Map();
  let totalIssues = 0;

  for (const run of runs) {
    const ruleIndex = harvestRuleIndex(run);
    const results = Array.isArray(run?.results) ? run.results : [];

    for (const result of results) {
      const ruleInfo = ruleIndex.get(result.ruleId) || { id: result.ruleId };
      const severity = normalizeSeverity(result, ruleInfo);
      summaryCounts.set(severity, (summaryCounts.get(severity) || 0) + 1);
      totalIssues += 1;

      const categoryIds = ruleInfo.categories?.length
        ? ruleInfo.categories
        : [UNCATEGORIZED_ID];

      const [firstLocation] = Array.isArray(result.locations) ? result.locations : [];

      const issueEntry = {
        severity,
        ruleId: ruleInfo.id || 'Unknown rule',
        ruleDescription: ruleInfo.shortDescription || ruleInfo.fullDescription,
        message: result.message?.text || '',
        location: formatLocation(firstLocation),
        helpUri: ruleInfo.helpUri,
        tags: Array.isArray(result?.properties?.tags) ? result.properties.tags : [],
      };

      for (const categoryId of categoryIds) {
        if (!categories.has(categoryId)) {
          categories.set(categoryId, {
            id: categoryId,
            label: humanizeCategoryId(categoryId),
            issues: [],
          });
        }
        categories.get(categoryId).issues.push(issueEntry);
      }
    }
  }

  return { summaryCounts, categories, totalIssues };
};

const sortBySeverity = (a, b) => {
  const indexA = SEVERITY_ORDER.indexOf(a);
  const indexB = SEVERITY_ORDER.indexOf(b);

  if (indexA === -1 && indexB === -1) {
    return a.localeCompare(b);
  }
  if (indexA === -1) {
    return 1;
  }
  if (indexB === -1) {
    return -1;
  }
  return indexA - indexB;
};

const buildSummaryTable = (summaryCounts, totalIssues) => {
  if (!summaryCounts.size) {
    return 'No issues found.';
  }

  const severities = Array.from(summaryCounts.keys()).sort(sortBySeverity);
  const rows = severities.map((severity) => `| ${escapeTableCell(severity)} | ${summaryCounts.get(severity)} |`);
  rows.push(`| Total | ${totalIssues} |`);

  return ['| Severity | Issues |', '| --- | --- |', ...rows].join('\n');
};

const buildCategorySections = (categories) => {
  const categoryList = Array.from(categories.values())
    .sort((a, b) => (b.issues.length === a.issues.length
      ? a.label.localeCompare(b.label)
      : b.issues.length - a.issues.length));

  const sections = categoryList.map((category) => {
    const issueTableRows = category.issues.map((issue) => {
      const ruleParts = [`**${escapeTableCell(issue.ruleId)}**`];
      if (issue.ruleDescription) {
        ruleParts.push(escapeTableCell(issue.ruleDescription));
      }
      const ruleCell = ruleParts.join('<br>');
      const tagsCell = issue.tags.length ? escapeTableCell(issue.tags.join(', ')) : '';
      const helpCell = issue.helpUri ? `[Docs](${escapeTableCell(issue.helpUri)})` : '';

      return `| ${ruleCell} | ${escapeTableCell(issue.severity)} | ${escapeTableCell(issue.message)} | ${escapeTableCell(issue.location)} | ${tagsCell} | ${helpCell} |`;
    });

    const tableHeader = '| Rule | Severity | Message | Location | Tags | Help |\n| --- | --- | --- | --- | --- | --- |';
    const tableBody = issueTableRows.join('\n');

    return [
      '<details>',
      `<summary>${escapeHtml(category.label)} (${category.issues.length})</summary>`,
      '',
      tableHeader,
      tableBody,
      '',
      '</details>',
      '',
    ].join('\n');
  });

  return sections.join('\n');
};

const generateMarkdownFromSarif = (sarif, options = {}) => {
  if (!sarif || !Array.isArray(sarif.runs)) {
    throw new Error('Provided SARIF content does not contain any runs.');
  }

  const { summaryCounts, categories, totalIssues } = collectResults(sarif.runs);
  const summaryTable = buildSummaryTable(summaryCounts, totalIssues);
  const categorySections = buildCategorySections(categories);

  const lines = ['# SARIF Report'];

  if (options.inputPath) {
    const relativePath = path.relative(process.cwd(), path.resolve(options.inputPath));
    lines.push('', `*Source: ${escapeHtml(relativePath)}*`);
  }

  lines.push('', '## Summary', '', summaryTable, '', '## Problem Categories', '', categorySections || 'No categorized issues found.');

  return lines.join('\n');
};

const main = () => {
  const [, , inputPath] = process.argv;
  if (!inputPath) {
    console.error('Usage: node src/generate-report.js <input-sarif>');
    process.exit(1);
  }

  const sarif = readSarif(inputPath);
  const markdown = generateMarkdownFromSarif(sarif, { inputPath });

  process.stdout.write(markdown);
};

if (require.main === module) {
  main();
}

module.exports = {
  generateMarkdownFromSarif,
};
