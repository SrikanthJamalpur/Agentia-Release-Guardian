"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { analyzeRelease } = require("../src/guardian");
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

test("transitively identifies downstream components in a dependency chain", () => {
  const result = analyzeRelease({
    name: "Transitive impact",
    changes: [{ component: "A", severity: "low" }],
    dependencies: {
      A: ["B"],
      B: ["C"]
    },
    evidence: []
  });

  assert.deepEqual(result.changedComponents, ["A"]);
  assert.deepEqual(result.impactedComponents, ["B", "C"]);
  assert.deepEqual(
    result.dependencyFindings.map(finding => finding.component),
    ["B", "C"]
  );
});

test("cycles do not re-report changed components or duplicate findings", () => {
  const result = analyzeRelease({
    name: "Cyclic impact",
    changes: [{ component: "A", severity: "low" }],
    dependencies: {
      A: ["B"],
      B: ["A", "C"],
      C: ["B"]
    },
    evidence: []
  });

  assert.deepEqual(result.changedComponents, ["A"]);
  assert.deepEqual(result.impactedComponents, ["B", "C"]);
  assert.equal(result.dependencyFindings.length, 2);
});

test("multiple changed components do not duplicate shared downstream findings", () => {
  const result = analyzeRelease({
    name: "Shared downstream impact",
    changes: [
      { component: "A", severity: "low" },
      { component: "D", severity: "low" }
    ],
    dependencies: {
      A: ["Shared"],
      D: ["Shared"],
      Shared: ["Leaf"]
    },
    evidence: []
  });

  assert.deepEqual(result.changedComponents, ["A", "D"]);
  assert.deepEqual(result.impactedComponents, ["Leaf", "Shared"]);
  assert.deepEqual(
    result.dependencyFindings.map(finding => finding.component),
    ["Shared", "Leaf"]
  );
});
