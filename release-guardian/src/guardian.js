"use strict";

const SEVERITY_POINTS = { low: 5, medium: 12, high: 25 };
const EVIDENCE_STATUSES = new Set(["passed", "failed", "missing", "not-run"]);
const HOLD_THRESHOLD = 35;
const BLOCK_THRESHOLD = 70;

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateScenario(scenario) {
  if (!isRecord(scenario)) {
    throw new TypeError("Scenario must be a JSON object.");
  }
  if (scenario.name !== undefined &&
      (typeof scenario.name !== "string" || !scenario.name.trim())) {
    throw new TypeError("Scenario name must be a non-empty string when provided.");
  }

  const changes = scenario.changes === undefined ? [] : scenario.changes;
  if (!Array.isArray(changes)) {
    throw new TypeError("Scenario changes must be an array.");
  }
  changes.forEach((change, index) => {
    const label = `Scenario changes[${index}]`;
    if (!isRecord(change)) {
      throw new TypeError(`${label} must be an object.`);
    }
    if (typeof change.component !== "string" || !change.component.trim()) {
      throw new TypeError(`${label}.component must be a non-empty string.`);
    }
    if (!Object.hasOwn(SEVERITY_POINTS, change.severity)) {
      throw new TypeError(
        `${label}.severity must be one of: ${Object.keys(SEVERITY_POINTS).join(", ")}.`
      );
    }
  });

  const dependencies = scenario.dependencies === undefined ? {} : scenario.dependencies;
  if (!isRecord(dependencies)) {
    throw new TypeError("Scenario dependencies must be an object mapping components to arrays.");
  }
  for (const [component, dependents] of Object.entries(dependencies)) {
    if (!component.trim()) {
      throw new TypeError("Scenario dependencies contains an empty component name.");
    }
    if (!Array.isArray(dependents)) {
      throw new TypeError(`Scenario dependencies.${component} must be an array.`);
    }
    dependents.forEach((dependent, index) => {
      if (typeof dependent !== "string" || !dependent.trim()) {
        throw new TypeError(
          `Scenario dependencies.${component}[${index}] must be a non-empty component name.`
        );
      }
    });
  }

  const evidence = scenario.evidence === undefined ? [] : scenario.evidence;
  if (!Array.isArray(evidence)) {
    throw new TypeError("Scenario evidence must be an array.");
  }
  evidence.forEach((item, index) => {
    const label = `Scenario evidence[${index}]`;
    if (!isRecord(item)) {
      throw new TypeError(`${label} must be an object.`);
    }
    if (typeof item.name !== "string" || !item.name.trim()) {
      throw new TypeError(`${label}.name must be a non-empty string.`);
    }
    if (typeof item.status !== "string" || !item.status.trim()) {
      throw new TypeError(`${label}.status must be a non-empty string.`);
    }
  });

  return { changes, dependencies, evidence };
}

function buildDependencyFindings(changes, dependencies) {
  const changedComponents = [...new Set(changes.map(change => change.component))].sort();
  const visited = new Set(changedComponents);
  const parentByComponent = new Map();
  const queue = [...changedComponents];

  for (let index = 0; index < queue.length; index += 1) {
    const component = queue[index];
    const dependents = [...new Set(dependencies[component] || [])].sort();
    for (const dependent of dependents) {
      if (!visited.has(dependent)) {
        visited.add(dependent);
        parentByComponent.set(dependent, component);
        queue.push(dependent);
      }
    }
  }

  const findings = queue
    .filter(component => !changedComponents.includes(component))
    .map(component => {
      const path = [component];
      let current = component;
      while (parentByComponent.has(current)) {
        current = parentByComponent.get(current);
        path.unshift(current);
      }
      const dependsOn = path[path.length - 2];
      const impactType = path.length === 2 ? "direct" : "transitive";
      return {
        component,
        dependsOn,
        impactType,
        path,
        reason: `${component} is a ${impactType} downstream dependency of ${path[0]}`
      };
    })
    .sort((left, right) => left.component.localeCompare(right.component));

  return { changedComponents, findings };
}

function analyzeRelease(scenario) {
  const { changes, dependencies, evidence } = validateScenario(scenario);
  const { changedComponents, findings } = buildDependencyFindings(changes, dependencies);

  const failed = evidence.filter(item => item.status === "failed");
  const missing = evidence.filter(item =>
    item.status === "missing" || item.status === "not-run"
  );
  const invalid = evidence.filter(item => !EVIDENCE_STATUSES.has(item.status));
  const missingCount = missing.length + (evidence.length === 0 ? 1 : 0);

  const changeRisk = changes.reduce(
    (total, change) => total + SEVERITY_POINTS[change.severity],
    0
  );
  const dependencyRisk = Math.min(30, findings.length * 10);
  const evidenceRisk = Math.min(25, missingCount * 12 + invalid.length * 12);
  const riskScore = Math.min(100, changeRisk + dependencyRisk + evidenceRisk);

  let decision;
  if (failed.length > 0) {
    decision = "BLOCK";
  } else if (invalid.length > 0 || missingCount > 0) {
    decision = "HOLD";
  } else if (riskScore >= BLOCK_THRESHOLD) {
    decision = "BLOCK";
  } else if (riskScore >= HOLD_THRESHOLD) {
    decision = "HOLD";
  } else {
    decision = "GO";
  }

  const reasons = [];

  if (failed.length) {
    reasons.push(`${failed.length} evidence check(s) failed`);
    for (const item of failed) {
      reasons.push(`Failed evidence: ${item.name}`);
    }
  }

  if (missingCount) {
    reasons.push(
      evidence.length === 0
        ? "No evidence checks were provided"
        : `${missingCount} evidence check(s) missing or not run`
    );

    for (const item of missing) {
      reasons.push(
        `${item.status === "missing" ? "Missing" : "Not run"} evidence: ${item.name}`
      );
    }

    if (evidence.length === 0) {
      reasons.push("Provide the required release evidence before review");
    }
  }

  if (invalid.length) {
    reasons.push(`${invalid.length} evidence check(s) have an unknown status`);
    for (const item of invalid) {
      reasons.push(`Unrecognized evidence status "${item.status}": ${item.name}`);
    }
  }

  if (findings.length) {
    reasons.push(`${findings.length} unique downstream component(s) identified`);
  }

  if (riskScore >= HOLD_THRESHOLD) {
    reasons.push(`Risk score ${riskScore}/100 requires review`);
  }

  if (!reasons.length) {
    reasons.push(
      "Evidence is complete and the calculated risk is below the review threshold"
    );
  }

  const evidenceStatuses = {
    passed: evidence.filter(item => item.status === "passed").length,
    failed: failed.length,
    missing: evidence.filter(item => item.status === "missing").length,
    notRun: evidence.filter(item => item.status === "not-run").length,
    unknown: invalid.length
  };

  return {
    scenario: scenario.name || "Unnamed scenario",
    decision,
    riskScore,
    changedComponents,
    impactedComponents: findings.map(finding => finding.component),
    dependencyFindings: findings,
    evidenceChecks: evidence.map(item => ({ name: item.name, status: item.status })),
    evidenceSummary: {
      total: evidence.length,
      noEvidenceProvided: evidence.length === 0,
      ...evidenceStatuses,
      missingOrNotRun: missing.length,
      invalid: invalid.length
    },
    reasons,
    recommendation: decision === "GO"
      ? "The analyzed checks passed. Follow the organization's approval process before deployment; this analysis is not deployment approval."
      : decision === "HOLD"
        ? "Confirm release readiness, obtain the relevant Copado job execution and automated test results, and rerun the impact analysis before considering promotion."
        : "Do not proceed until failed checks or blocking risks are resolved."
  };
}

function formatMarkdown(report) {
  const findings = report.dependencyFindings.length
    ? report.dependencyFindings.map(finding =>
      `- ${finding.component} (${finding.impactType}; path: ${finding.path.join(" -> ")})`
    )
    : ["- None"];
  const evidenceChecks = report.evidenceChecks.length
    ? report.evidenceChecks.map(item => `- ${item.name}: ${item.status}`)
    : ["- None provided"];

  return [
    `**Decision:** ${report.decision}`,
    `**Risk score:** ${report.riskScore}/100`,
    "",
    "## Components",
    `- Changed: ${report.changedComponents.join(", ") || "None"}`,
    `- Downstream impacted: ${report.impactedComponents.join(", ") || "None"}`,
    "",
    "## Dependency findings",
    ...findings,
    "",
    "## Evidence",
    `- Total: ${report.evidenceSummary.total}`,
    `- No evidence provided: ${report.evidenceSummary.noEvidenceProvided ? "Yes" : "No"}`,
    `- Passed: ${report.evidenceSummary.passed}`,
    `- Failed: ${report.evidenceSummary.failed}`,
    `- Missing: ${report.evidenceSummary.missing}`,
    `- Not run: ${report.evidenceSummary.notRun}`,
    `- Unknown status: ${report.evidenceSummary.unknown}`,
    "",
    "### Checks",
    ...evidenceChecks,
    "",
    "## Decision reasons",
    ...report.reasons.map(reason => `- ${reason}`),
    "",
    `**Recommended next action:** ${report.recommendation}`
  ].join("\n");
}

module.exports = { analyzeRelease, formatMarkdown };
