"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { analyzeRelease, formatMarkdown } = require("../src/guardian");
const { generateReports } = require("../src/cli");
const demo = require("../fixtures/demo.json");

test("low-risk change with complete evidence is GO", () => {
  const result = analyzeRelease(demo.scenarios[0]);
  assert.equal(result.decision, "GO");
  assert.equal(result.evidenceSummary.missing, 0);
  assert.equal(result.evidenceSummary.failed, 0);
});

test("missing evidence causes HOLD", () => {
  const result = analyzeRelease(demo.scenarios[1]);
  assert.equal(result.decision, "HOLD");
  assert.ok(result.impactedComponents.includes("CheckoutFlow"));
  assert.equal(result.evidenceSummary.missing, 1);
});

test("a failed required test causes BLOCK", () => {
  const result = analyzeRelease(demo.scenarios[2]);
  assert.equal(result.decision, "BLOCK");
  assert.equal(result.evidenceSummary.failed, 1);
});

test("unknown evidence status cannot silently pass", () => {
  const result = analyzeRelease({
    name: "Unknown status",
    changes: [{ component: "AccountRule", severity: "low" }],
    evidence: [{ name: "Tests", status: "unknown" }]
  });
  assert.equal(result.decision, "HOLD");
  assert.equal(result.evidenceSummary.invalid, 1);
});

test("transitive dependencies have readable paths and cycle protection", () => {
  const result = analyzeRelease({
    name: "Dependency chain",
    changes: [{ component: "A", severity: "low" }],
    dependencies: { A: ["B"], B: ["C"], C: ["A"] },
    evidence: [{ name: "Tests", status: "passed" }]
  });

  assert.deepEqual(result.changedComponents, ["A"]);
  assert.deepEqual(result.impactedComponents, ["B", "C"]);
  assert.deepEqual(
    result.dependencyFindings.map(({ component, impactType, path: chain }) =>
      ({ component, impactType, path: chain })
    ),
    [
      { component: "B", impactType: "direct", path: ["A", "B"] },
      { component: "C", impactType: "transitive", path: ["A", "B", "C"] }
    ]
  );
});

test("shared and repeated dependencies produce one finding per impacted component", () => {
  const result = analyzeRelease({
    changes: [
      { component: "A", severity: "low" },
      { component: "X", severity: "low" }
    ],
    dependencies: { A: ["B", "B"], X: ["B"], B: ["C"], C: ["B"] },
    evidence: [{ name: "Tests", status: "passed" }]
  });

  assert.deepEqual(result.changedComponents, ["A", "X"]);
  assert.deepEqual(result.impactedComponents, ["B", "C"]);
  assert.equal(result.dependencyFindings.length, 2);
  assert.deepEqual(result.dependencyFindings[0].path, ["A", "B"]);
});

test("invalid scenario structures return actionable errors", () => {
  const cases = [
    [null, /Scenario must be a JSON object/],
    [{ changes: {} }, /changes must be an array/],
    [{ changes: [{ severity: "low" }] }, /changes\[0\]\.component/],
    [{ changes: [{ component: "A", severity: "urgent" }] }, /severity must be one of/],
    [{ dependencies: { A: "B" } }, /dependencies\.A must be an array/],
    [{ dependencies: { A: [""] } }, /dependencies\.A\[0\]/],
    [{ evidence: {} }, /evidence must be an array/],
    [{ evidence: [null] }, /evidence\[0\] must be an object/],
    [{ evidence: [{ name: "Tests" }] }, /evidence\[0\]\.status/]
  ];

  for (const [scenario, message] of cases) {
    assert.throws(() => analyzeRelease(scenario), message);
  }
});

test("no evidence and not-run evidence cannot result in GO", () => {
  const noEvidence = analyzeRelease({
    changes: [{ component: "A", severity: "low" }]
  });
  const notRun = analyzeRelease({
    changes: [{ component: "A", severity: "low" }],
    evidence: [{ name: "Tests", status: "not-run" }]
  });

  assert.equal(noEvidence.decision, "HOLD");
  assert.equal(noEvidence.evidenceSummary.noEvidenceProvided, true);
  assert.equal(notRun.decision, "HOLD");
});

test("risk score is deterministic and preserves documented contributions", () => {
  const scenario = {
    changes: [{ component: "A", severity: "medium" }],
    dependencies: { A: ["B", "C", "D", "E"] },
    evidence: [{ name: "Tests", status: "passed" }]
  };

  const first = analyzeRelease(scenario);
  const second = analyzeRelease(scenario);
  assert.equal(first.riskScore, 42);
  assert.equal(first.decision, "HOLD");
  assert.deepEqual(first, second);
});

test("Markdown report includes decision, dependency paths, evidence, and action", () => {
  const report = analyzeRelease(demo.scenarios[1]);
  const markdown = formatMarkdown(report);

  assert.match(markdown, /\*\*Decision:\*\* HOLD/);
  assert.match(markdown, /## Dependency findings/);
  assert.match(markdown, /## Evidence/);
  assert.match(markdown, /## Decision reasons/);
  assert.match(markdown, /\*\*Recommended next action:\*\*/);
});

test("report generation covers GO, HOLD, and BLOCK with matching evidence", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "release-guardian-"));
  try {
    const inputPath = path.join(tempDir, "demo.json");
    const reportsDir = path.join(tempDir, "reports");
    fs.writeFileSync(inputPath, JSON.stringify(demo), "utf8");

    const output = generateReports(inputPath, reportsDir);
    const jsonResults = JSON.parse(fs.readFileSync(output.jsonPath, "utf8"));
    const markdown = fs.readFileSync(output.mdPath, "utf8");

    assert.equal(output.scenarioCount, 3);
    assert.deepEqual(jsonResults.map(item => item.report.decision), ["GO", "HOLD", "BLOCK"]);
    assert.deepEqual(jsonResults.map(item => item.name), demo.scenarios.map(item => item.name));
    assert.ok(jsonResults.every(item => item.report.evidenceSummary.total === 2));
    for (const item of jsonResults) {
      assert.ok(markdown.includes(`# ${item.name}`));
      assert.ok(markdown.includes(`**Decision:** ${item.report.decision}`));
      assert.ok(markdown.includes(`- Total: ${item.report.evidenceSummary.total}`));
      assert.equal(item.report.evidenceChecks.length, item.report.evidenceSummary.total);
      for (const check of item.report.evidenceChecks) {
        assert.ok(markdown.includes(`- ${check.name}: ${check.status}`));
      }
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("report generation reports fixture errors with context", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "release-guardian-"));
  try {
    const inputPath = path.join(tempDir, "invalid.json");
    fs.writeFileSync(inputPath, "{", "utf8");
    assert.throws(
      () => generateReports(inputPath, path.join(tempDir, "reports")),
      /Unable to read demo fixture/
    );

    fs.writeFileSync(inputPath, JSON.stringify({ scenarios: [{ changes: [{}] }] }), "utf8");
    assert.throws(
      () => generateReports(inputPath, path.join(tempDir, "reports")),
      /Unable to analyze scenario 1: Scenario changes\[0\]\.component/
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

test("CLI generates reports for every demo scenario", () => {
  const cliPath = path.join(__dirname, "..", "src", "cli.js");
  const result = spawnSync(process.execPath, [cliPath], {
    cwd: path.join(__dirname, ".."),
    encoding: "utf8"
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Release Guardian completed\. Scenarios: 3/);
  const reportsDir = path.join(__dirname, "..", "reports");
  const jsonResults = JSON.parse(
    fs.readFileSync(path.join(reportsDir, "release-guardian-report.json"), "utf8")
  );
  const markdown = fs.readFileSync(
    path.join(reportsDir, "release-guardian-report.md"),
    "utf8"
  );
  assert.deepEqual(jsonResults.map(item => item.report.decision), ["GO", "HOLD", "BLOCK"]);
  assert.match(markdown, /- Passed: 2/);
  assert.match(markdown, /- Failed: 1/);
});

test("duplicate change entries contribute severity points per entry", () => {
  const result = analyzeRelease({
    name: "Duplicate change entries",
    changes: [
      { component: "AccountRule", severity: "low" },
      { component: "AccountRule", severity: "low" }
    ],
    evidence: [{ name: "Unit tests", status: "passed" }]
  });

  assert.deepEqual(result.changedComponents, ["AccountRule"]);
  assert.equal(result.riskScore, 10);
  assert.equal(result.decision, "GO");
});

test("failed evidence blocks even when numerical risk is below threshold", () => {
  const result = analyzeRelease({
    name: "Failed evidence precedence",
    changes: [{ component: "AccountRule", severity: "low" }],
    evidence: [
      { name: "Unit tests", status: "failed" },
      { name: "Regression tests", status: "passed" }
    ]
  });

  assert.equal(result.riskScore, 5);
  assert.equal(result.decision, "BLOCK");
  assert.ok(
    result.reasons.some(reason => reason.includes("evidence check(s) failed"))
  );
});

test("risk thresholds handle values below and exactly at boundaries", () => {
  const makeScenario = (name, changes, dependencies = {}) => ({
    name,
    changes,
    dependencies,
    evidence: [{ name: "Unit tests", status: "passed" }]
  });

  const cases = [
    {
      scenario: makeScenario(
        "Below HOLD",
        [{ component: "A", severity: "medium" }],
        { A: ["B", "C"] }
      ),
      riskScore: 32,
      decision: "GO"
    },
    {
      scenario: makeScenario(
        "At HOLD",
        [{ component: "A", severity: "low" }],
        { A: ["B", "C", "D"] }
      ),
      riskScore: 35,
      decision: "HOLD"
    },
    {
      scenario: makeScenario("Below BLOCK", [
        { component: "A", severity: "high" },
        { component: "B", severity: "high" },
        { component: "C", severity: "low" },
        { component: "D", severity: "low" },
        { component: "E", severity: "low" }
      ]),
      riskScore: 65,
      decision: "HOLD"
    },
    {
      scenario: makeScenario("At BLOCK", [
        { component: "A", severity: "high" },
        { component: "B", severity: "high" },
        { component: "C", severity: "low" },
        { component: "D", severity: "low" },
        { component: "E", severity: "low" },
        { component: "F", severity: "low" }
      ]),
      riskScore: 70,
      decision: "BLOCK"
    }
  ];

  for (const { scenario, riskScore, decision } of cases) {
    const result = analyzeRelease(scenario);
    assert.equal(result.riskScore, riskScore, scenario.name);
    assert.equal(result.decision, decision, scenario.name);
  }
});
