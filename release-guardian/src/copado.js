
"use strict";

const { spawnSync } = require("node:child_process");
const { analyzeRelease, formatMarkdown } = require("./guardian");

const ALLOWED_STATUSES = new Set([
  "Draft",
  "In Progress",
  "Ready",
  "Completed",
  "Closed"
]);

function fetchCopadoStory(storyId,options={}){
 const isStoryName =
  typeof storyId === "string" &&
  /^US-[A-Za-z0-9-]+$/i.test(storyId);

const isRecordId =
  typeof storyId === "string" &&
  /^[A-Za-z0-9]{15,18}$/.test(storyId);

if (!isStoryName && !isRecordId) {
  throw new TypeError(
    "Provide a valid Copado story name (US-0000024) or record ID."
  );
}

 const run = options.spawnSync || spawnSync;
const executable = options.executable || process.execPath;
const agentiaEntry = options.agentiaEntry ||
  require("node:path").join(
    process.env.APPDATA,
    "npm",
    "node_modules",
    "@copado",
    "agentia-cli",
    "bin",
    "run.js"
  );
  // Never print the raw CLI response: it may contain sensitive fields.
  const result = run(
    executable,
    [agentiaEntry, "cicd", "work", "get", storyId, "--json"],
    {
      cwd: process.env.INIT_CWD || process.cwd(),
      encoding: "utf8",
      windowsHide: true,
      timeout: 90000,
      maxBuffer: 5 * 1024 * 1024,
      shell: false
    }
  );


  if (result.error) {
    throw new Error("Unable to run Agentia CLI. Check the local installation and execution environment.");
  }

  if (result.status !== 0) {
    const safeStatus =
      result.status === null ? "null" : String(result.status);

    throw new Error(
      `Agentia could not retrieve the Copado story (exit status: ${safeStatus}).`
    );
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    throw new Error("Agentia returned a response that was not valid JSON.");
  }

  const story = payload && payload.result;
  if (!story || typeof story !== "object" || Array.isArray(story)) {
    throw new Error("Agentia response did not contain a Copado story.");
  }

  // Allowlist only the fields required for the report.
  // Never copy the raw story object into the report.
  const safeStory = {
    id: typeof story.name === "string" ? story.name : storyId,
    title: typeof story.title === "string" ? story.title : "Untitled Copado story",
    status: typeof story.status === "string" &&
      ALLOWED_STATUSES.has(story.status) ? story.status : "Unknown",
    project: typeof story.projectName === "string"
      ? story.projectName : "Unknown project",
    pipeline: typeof story.pipelineName === "string"
      ? story.pipelineName : "Unknown pipeline",
    testLevel: typeof story.promotionTestLevel === "string"
      ? story.promotionTestLevel : "Unknown",
    hasApexCode: typeof story.hasApexCode === "boolean"
      ? story.hasApexCode : null,
    lastValidationDate: typeof story.lastValidationDate === "string"
      ? story.lastValidationDate : null
  };

  return safeStory;
}

function buildCopadoScenario(story) {
  // The story response does not establish changed metadata components,
  // dependency relationships, or passing test results.
  const scenario = {
    name: `Copado ${story.id}: ${story.title}`,
    changes: [],
    dependencies: {},
    evidence: [
      { name: "Copado story is in a release-ready state", status: "missing" },
      { name: "Related Copado job execution evidence", status: "missing" },
      { name: "Required automated test evidence", status: "missing" }
    ]
  };

  if (story.status === "Draft") {
    scenario.evidence.push({
      name: "Story status",
      status: "not-run"
    });
  }

  return scenario;
}

function analyzeCopadoStory(storyId,options={}){
  const story = fetchCopadoStory(storyId, options);
  const scenario = buildCopadoScenario(story);
  const analysis = analyzeRelease(scenario);

const report = {
  ...analysis,
  changedComponents: null,
  impactedComponents: null
};

  const releasePassport = {
    passportVersion: "1.0",
    generatedAt: new Date().toISOString(),
    source: "Copado via Agentia CLI",
    story,
    impactAssessment: {
      status: "NOT_ASSESSED",
      changedComponents: null,
      impactedComponents: null,
      reason:
        "Live changed-component and dependency data were not retrieved. " +
        "Zero components in the local analysis must not be interpreted as zero real-world impact."
    },
    evidenceLedger: report.evidenceChecks.map(item => ({
      name: item.name,
      status: item.status,
      verifiedFromCopado: false
    })),
    decision: report.decision,
    riskScore: report.riskScore,
    reasons: report.reasons,
    recommendation: report.recommendation,
    analysisScope: {
      storyContextRetrieved: true,
      liveMetadataRetrieved: false,
      liveDependencyAnalysisPerformed: false,
      automatedTestResultsRetrieved: false,
      deploymentTriggered: false
    }
  };

  const markdown = [
  "# Agentia Release Guardian - Release Passport",
  "",
  `- Passport version: ${releasePassport.passportVersion}`,
  `- Generated at (UTC): ${releasePassport.generatedAt}`,
  `- Source: ${releasePassport.source}`,
  "",
  "## 1. Copado story",
    `- Story: ${story.id}`,
    `- Title: ${story.title}`,
    `- Status: ${story.status}`,
    `- Project: ${story.project}`,
    `- Pipeline: ${story.pipeline}`,
    `- Promotion test level: ${story.testLevel}`,
    `- Apex code indicated: ${
      story.hasApexCode === null ? "Unknown" : story.hasApexCode
    }`,
    `- Last validation: ${story.lastValidationDate || "Not provided"}`,
    "",
    "## 2. Change-impact assessment",
    "**Status: NOT ASSESSED**",
    "",
    releasePassport.impactAssessment.reason,
    "",
    "## 3. Evidence ledger",
    ...releasePassport.evidenceLedger.map(
      item => `- **${item.status.toUpperCase()}** - ${item.name}`
    ),
    "",
    "## 4. Release decision",
    `- **Decision:** ${report.decision}`,
    `- **Risk score:** ${report.riskScore}/100`,
    "",
    "### Decision rationale",
    ...report.reasons.map(reason => `- ${reason}`),
    "",
    "### Recommended next action",
    report.recommendation,
    "",
    "## 5. Verification boundaries",
    "- Copado story context was retrieved through Agentia CLI.",
    "- Live Salesforce metadata and dependency impact were not retrieved.",
    "- Automated test success has not been established by this report.",
    "- This is a read-only advisory assessment, not deployment approval."
  ].join("\n");

  return {
    source: releasePassport.source,
    story,
    report,
    releasePassport,
    markdown
  };
}

module.exports = {
  fetchCopadoStory,
  buildCopadoScenario,
  analyzeCopadoStory
};
