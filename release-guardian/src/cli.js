"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { analyzeRelease, formatMarkdown } = require("./guardian");

function generateReports(inputPath, reportsDir) {
  let demo;
  try {
    demo = JSON.parse(fs.readFileSync(inputPath, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new Error(`Unable to read demo fixture "${inputPath}": ${error.message}`);
  }

  if (demo === null || typeof demo !== "object" || Array.isArray(demo)) {
    throw new Error("Demo fixture must contain a JSON object.");
  }

  const scenarios = demo.scenarios === undefined ? [demo] : demo.scenarios;
  if (!Array.isArray(scenarios) || scenarios.length === 0) {
    throw new Error("Demo fixture scenarios must be a non-empty array.");
  }

  const results = scenarios.map((scenario, index) => {
    try {
      const report = analyzeRelease(scenario);
      return { name: report.scenario, report };
    } catch (error) {
      throw new Error(`Unable to analyze scenario ${index + 1}: ${error.message}`);
    }
  });

  const jsonPath = path.join(reportsDir, "release-guardian-report.json");
  const mdPath = path.join(reportsDir, "release-guardian-report.md");
  const jsonContent = JSON.stringify(results, null, 2);
  const markdownContent = results.map(({ name, report }) =>
    `# ${name}\n\n${formatMarkdown(report)}`
  ).join("\n\n---\n\n");

  try {
    fs.mkdirSync(reportsDir, { recursive: true });
    fs.writeFileSync(jsonPath, jsonContent, "utf8");
    fs.writeFileSync(mdPath, markdownContent, "utf8");
  } catch (error) {
    throw new Error(`Unable to write Release Guardian reports: ${error.message}`);
  }

  return { scenarioCount: results.length, jsonPath, mdPath, results };
}

function main() {
  const inputPath = path.join(__dirname, "..", "fixtures", "demo.json");
  const reportsDir = path.join(__dirname, "..", "reports");

  try {
    const output = generateReports(inputPath, reportsDir);
    console.log(`Release Guardian completed. Scenarios: ${output.scenarioCount}`);
    console.log(`JSON report: ${output.jsonPath}`);
    console.log(`Markdown report: ${output.mdPath}`);
  } catch (error) {
    console.error(`Release Guardian failed: ${error.message}`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
}

module.exports = { generateReports };
