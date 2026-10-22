const fs = require("node:fs");
const path = require("node:path");
const { analyzeRelease, formatMarkdown } = require("./guardian");

function main() {
  const inputPath = path.join(__dirname, "..", "fixtures", "demo.json");
  const raw = fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, "");
  const demo = JSON.parse(raw);

  const scenarios = demo.scenarios || [demo];
  const reportsDir = path.join(__dirname, "..", "reports");
  fs.mkdirSync(reportsDir, { recursive: true });

  const results = scenarios.map((scenario) => {
    const report = analyzeRelease(scenario);
    const name = scenario.name || scenario.scenario || "Release analysis";
    return { name, report };
  });

  const jsonPath = path.join(reportsDir, "release-guardian-report.json");
  const mdPath = path.join(reportsDir, "release-guardian-report.md");

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");
  fs.writeFileSync(
    mdPath,
    results.map(({ name, report }) =>
      `# ${name}\n\n${formatMarkdown(report)}`
    ).join("\n\n---\n\n"),
    "utf8"
  );

  console.log(`Release Guardian completed. Scenarios: ${results.length}`);
  console.log(`JSON report: ${jsonPath}`);
  console.log(`Markdown report: ${mdPath}`);

}

main();
