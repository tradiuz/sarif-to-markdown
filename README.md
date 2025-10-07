# SARIF Markdown Report

Convert Qodana SARIF findings into a readable Markdown digest that slots neatly into continuous integration workflows.  This project focuses on an actionable summary: severity counts, collapsible categories, and rich per-issue tables that make code review easier.

## Why This Project?

- **Qodana** - Qodana by Jetbrains is a great static analysis tool and I wanted an easy way to review its outputs in PRs - hence this project
- **Readable Insights** – Qodana (and other static analyzers) emit SARIF files that are great for machines, less so for humans. This action turns them into Markdown your teammates actually want to read.
- **Feature-complete tables** – Issues are grouped by category, include severity, human-readable rule descriptions, file locations, tags, and documentation links.
- **CI-friendly** – Works as a GitHub Action and as a standalone CLI script, making it simple to slip into existing pipelines.

## Features

- Severity summary table with totals.
- Collapsible sections by problem category with detailed issue tables.
- Supports Qodana’s `qodanaSeverity`, rule metadata, and relationships.
- Outputs Markdown to stdout, to a file, and/or to the GitHub job summary.
- Lightweight: pure Node.js, minimal dependencies, snapshot-tested for stability.

## Example Markdown Output

```md
# SARIF Report

*Source: test-data/qodana.sarif.json*

## Summary

| Severity | Issues |
| --- | --- |
| High | 43 |
| Moderate | 99 |
| Total | 142 |

## Problem Categories

<details>
<summary>C# › Best Practice (35)</summary>

| Rule | Severity | Message | Location | Tags | Help |
| --- | --- | --- | --- | --- | --- |
| **AutoPropertyCanBeMadeGetOnly.Global**<br>Auto-property can be made get-only: Non-private accessibility | Moderate | Auto-property can be made get-only | src/API/DTOs/UpdateCategoryDto.cs:9 | C#, .NET 9.0 | [Docs](https://www.jetbrains.com/help/resharper/AutoPropertyCanBeMadeGetOnly.Global.html) |
| **AutoPropertyCanBeMadeGetOnly.Global**<br>Auto-property can be made get-only: Non-private accessibility | Moderate | Auto-property can be made get-only | src/Domain/Base/Entity.cs:5 | C#, .NET 9.0 | [Docs](https://www.jetbrains.com/help/resharper/AutoPropertyCanBeMadeGetOnly.Global.html) |

...
...
```

## GitHub Action Usage

Add the workflow in `.github/workflows/ci.yml` (or extend your existing workflow):

```yaml
name: SARIF Report

on:
  pull_request:
  push:
    branches: [ main ]

jobs:
  sarif-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Generate SARIF file
        run: ...

      - name: Generate Markdown report
        uses: b-zurg/sarif-to-markdown@v1
        with:
          file-path: ${{ runner.temp }}/sarif.json
          add-job-summary: true
```

### Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `file-path` | ✔ | – | Path to the SARIF 2.1.0 JSON file. |
| `add-job-summary` | ✖ | `true` | Append the report to the GitHub Actions job summary. |

### Outputs

| Output | Description |
| --- | --- |
| `markdown` | Markdown content as a string (use in downstream workflow steps). |

## Integration with PR comments

You can use this as a starting point to add the output markdown to a comment. This uses the github cli to add or edit the last comment by the github bot user. 

```yaml
      - name: Create or update comment comment
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh pr comment ${{ github.event.pull_request.number }} \
            --repo ${{ github.repository }} \
            --edit-last \
            --create-if-none \
            --body "${{ steps.generate-sarif-md.outputs.markdown }}"

```

## Compatibility

This project was developed against the Sarif 2.1.0 schema. PRs are welcome to adapt to other schemas if needed.


## CLI Usage

Run the converter directly with Node.js:

```bash
node src/generate-report.js test-data/qodana.sarif.json
```

## Development

Install dependencies and run the snapshot test suite:

```bash
npm ci
npm test
```

The test harness compares generated Markdown against a checked-in snapshot so you can make controlled formatting changes.

## Roadmap Ideas

- Additional templates (e.g., summary-only view).
- Support for other static analyzers that emit SARIF.
- Optional filtering (severity thresholds, include/exclude categories).

Contributions and ideas are welcome!
