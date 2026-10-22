"use strict";

const SEVERITY_POINTS = { low: 5, medium: 12, high: 25 };

function analyzeRelease(scenario) {
  const changes = scenario.changes || [];
  const dependencies = scenario.dependencies || {};
  const evidence = scenario.evidence || [];

  const impacted = new Set(changes.map(c => c.component));
  const impactReasons = [];

  for (const component of [...impacted]) {
    for (const dependent of dependencies[component] || []) {
      if (!impacted.has(dependent)) {
        impacted.add(dependent);
        impactReasons.push({
          component: dependent,
          dependsOn: component,
          reason: `${dependent} depends on changed component ${component}`
        });
      }
    }
  }

  const failed = evidence.filter(e => e.status === "failed");
  const missing = evidence.filter(e =>
    e.status === "missing" || e.status === "not-run"
  );
  const invalid = evidence.filter(e =>
    !["passed", "failed", "missing", "not-run"].includes(e.status)
  );

  const changeRisk = changes.reduce(
    (total, change) => total + (SEVERITY_POINTS[change.severity] || 12),
    0
  );

  const dependencyRisk = Math.min(30, impactReasons.length * 10);
  const evidenceRisk = Math.min(25, missing.length * 12 + invalid.length * 12);
  const riskScore = Math.min(100, changeRisk + dependencyRisk + evidenceRisk);

  let decision;
  if (failed.length > 0) {
    decision = "BLOCK";
  } else if (invalid.length > 0 || missing.length > 0) {
    decision = "HOLD";
  } else if (riskScore >= 70) {
    decision = "BLOCK";
  } else if (riskScore >= 35) {
    decision = "HOLD";
  } else {
    decision = "GO";
  }

  const reasons = [];
  if (failed.length) reasons.push(`${failed.length} required evidence check(s) failed`);
  if (missing.length) reasons.push(`${missing.length} evidence check(s) missing or not run`);
  if (invalid.length) reasons.push(`${invalid.length} evidence check(s) have an unknown status`);
  if (impactReasons.length) reasons.push(`${impactReasons.length} downstream dependency/dependencies identified`);
  if (riskScore >= 35) reasons.push(`Risk score ${riskScore}/100 requires review`);
  if (!reasons.length) reasons.push("Evidence is complete and the calculated risk is below the review threshold");

  return {
    scenario: scenario.name || "Unnamed scenario",
    decision,
    riskScore,
    changedComponents: changes.map(c => c.component),
    impactedComponents: [...impacted].sort(),
    dependencyFindings: impactReasons,
    evidenceSummary: {
      total: evidence.length,
      passed: evidence.filter(e => e.status === "passed").length,
      failed: failed.length,
      missing: missing.length,
      invalid: invalid.length
    },
    reasons,
    recommendation: decision === "GO"
      ? "Proceed to the authorized release process; this analysis is not deployment approval."
      : decision === "HOLD"
        ? "Collect missing evidence and review the impact before proceeding."
        : "Do not proceed until failed checks or blocking risks are resolved."
  };
}

module.exports = { analyzeRelease };
