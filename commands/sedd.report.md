# /sedd.report - Generate Feature Report (HTML + PDF)

## Purpose
Generate a beautiful HTML report from SEDD feature artifacts (spec, changelog, tasks, validation) and optionally convert to PDF via Puppeteer.

## Trigger
- `/sedd.report` - Generate report for current feature
- `/sedd.report --pdf` - Generate HTML + PDF
- `/sedd.report --open` - Generate and open in browser

## Pre-flight Checks

1. **Load Configuration**
   ```
   Read sedd.config.json (or use defaults)
   Default specsDir: .sedd
   ```

2. **Verify Feature Exists**
   - Must have spec.md
   - Must have _meta.json

3. **Check Puppeteer (for PDF)**
   - If `--pdf` flag, try puppeteer locally first, then via `npx`
   - Falls back to suggesting browser print (Ctrl+P) if unavailable

## Workflow

### Step 1: Load All Feature Artifacts

Read from feature directory:
- `spec.md` - Feature specification
- `_meta.json` - Metadata (expectation, migrations, contract)
- `CHANGELOG.md` - Feature changelog
- `interfaces.ts` - TypeScript interfaces
- `progress.md` - Implementation progress (if exists)
- `estimate.md` - Effort estimation (if exists)
- All migration folders:
  - `{migration}/clarify.md`
  - `{migration}/tasks.md`
  - `{migration}/decisions.md`
  - `{migration}/acceptance.md`
  - `{migration}/validation.md`

### Step 2: Parse Markdown to Sections

Extract structured data from each file:
- Feature name, ID, branch, dates
- Expectation (summary, must, mustNot)
- Architecture Contract (tech stack, patterns, locations, shared contracts)
- User stories with acceptance criteria
- Architecture analysis summary
- Task list with status
- Decisions made
- Validation results (if exists)
- Quality scores (if exists)
- Git stats (files changed, lines added/removed)

### Step 3: Generate HTML Report

Use the report template (`templates/report-template.html`) with the parsed data.

The HTML includes:
- **Header** — Feature name, ID, branch, date, status badge
- **Executive Summary** — Key metrics cards (tasks, coverage, quality)
- **Expectation** — Original expectation with DEVE/NAO DEVE
- **Architecture Contract** — Tech stack, patterns, locations table
- **User Stories** — Stories with acceptance criteria status
- **Migrations Timeline** — Visual timeline of clarifications
- **Tasks** — Grouped by category with status indicators
- **Decisions** — Key decisions with context
- **Validation** — Coverage chart, quality scores, gaps
- **Changelog** — Feature history
- **Footer** — Generated timestamp, SEDD version

### Step 4: Write HTML File

Save to `{specsDir}/{feature}/report.html`

### Step 5: Generate PDF (if --pdf)

Use Puppeteer to convert HTML to PDF:

```typescript
const browser = await puppeteer.launch({ headless: true });
const page = await browser.newPage();
await page.setContent(html, { waitUntil: 'networkidle0' });
await page.pdf({
  path: pdfPath,
  format: 'A4',
  margin: { top: '20mm', bottom: '20mm', left: '15mm', right: '15mm' },
  printBackground: true,
});
await browser.close();
```

Save to `{specsDir}/{feature}/report.pdf`

### Step 6: Display Result

```
📄 Report gerado!

  HTML: .sedd/024-dark-mode/report.html
  PDF:  .sedd/024-dark-mode/report.pdf (se --pdf)

  Feature: Dark Mode Toggle (024)
  Status: In Progress
  Tasks: 3/5 (60%)
  Coverage: 75%
  Quality: B+
```

## Output

1. **report.html** - Beautiful HTML report
2. **report.pdf** - PDF version (optional, requires Puppeteer)

## Rules

- **NUNCA fazer commit nem push** — o usuário controla quando commitar
- ALWAYS read ALL available artifacts before generating
- HTML must be SELF-CONTAINED (inline CSS, no external dependencies)
- PDF must look professional (proper margins, page breaks, print styles)
- Report includes Architecture Contract section
- Include git diff stats if available
- Use color coding: green=done, yellow=in-progress, red=gaps/violations

## CLI Alternative

```bash
# Generate HTML report
sedd report

# Generate HTML + PDF
sedd report --pdf

# Generate and open in browser
sedd report --open

# Generate for specific feature
sedd report --feature 024-dark-mode
```

**Options:**
- `--pdf` - Also generate PDF via Puppeteer
- `--open` - Open HTML in default browser after generation
- `--feature <dir>` - Specify feature directory
- `-o, --output <path>` - Custom output path
