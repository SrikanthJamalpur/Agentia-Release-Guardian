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
