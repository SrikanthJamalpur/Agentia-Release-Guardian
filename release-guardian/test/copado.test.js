
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  fetchCopadoStory,
  buildCopadoScenario,
  analyzeCopadoStory
} = require("../src/copado");

const sampleStory = {
  name: "US-0000024",
  title: "My first Source Format User Story",
  status: "Draft",
  projectName: "Trial - Salesforce Source Format",
  pipelineName: "Trial - Salesforce Source Format Pipeline",
  promotionTestLevel: "NoTestRun",
  hasApexCode: false,
  lastValidationDate: "2026-10-23T18:48:54Z",
  oauthSignature: "DO_NOT_LEAK_THIS",
  sourceOrgId: "DO_NOT_INCLUDE_THIS_EITHER"
};

function mockSpawnSync(executable, args) {
  assert.equal(executable, process.execPath);
  assert.equal(typeof args[0], "string");
  assert.ok(args[0].endsWith("run.js"));

  assert.deepEqual(args.slice(1), [
    "cicd", "work", "get", "US-0000024", "--json"
  ]);

  return {
    status: 0,
    stdout: JSON.stringify({ result: sampleStory }),
    stderr: ""
  };
}


test("Copado adapter uses an allowlist and excludes sensitive fields", () => {
  const story = fetchCopadoStory("US-0000024", {
    spawnSync: mockSpawnSync
  });

  assert.equal(story.id, "US-0000024");
  assert.equal(story.status, "Draft");
  assert.equal(story.testLevel, "NoTestRun");
  assert.equal(Object.hasOwn(story, "oauthSignature"), false);
  assert.equal(Object.hasOwn(story, "sourceOrgId"), false);
});

test("invalid story IDs are rejected before invoking Agentia", () => {
  assert.throws(
    () => fetchCopadoStory("US-0000024; malicious-command", {
      spawnSync() {
        throw new Error("Should not run");
      }
    }),
    /valid Copado story name/
  );
});

test("Copado story with missing release evidence results in HOLD", () => {
  const story = {
    id: "US-0000024",
    title: "Draft example",
    status: "Draft",
    project: "Example project",
    pipeline: "Example pipeline",
    testLevel: "NoTestRun",
    hasApexCode: false,
    lastValidationDate: null
  };

  const scenario = buildCopadoScenario(story);
  const output = analyzeCopadoStory("US-0000024", {
    spawnSync: mockSpawnSync
  });

  assert.equal(scenario.changes.length, 0);
  assert.equal(output.report.decision, "HOLD");
  assert.ok(output.report.evidenceSummary.missing > 0);
  assert.equal(output.story.id, "US-0000024");
  assert.equal(output.markdown.includes("DO_NOT_LEAK_THIS"), false);
  assert.equal(output.markdown.includes("DO_NOT_INCLUDE_THIS_EITHER"), false);
});


test("Release Passport distinguishes unknown impact from zero impact", () => {
  const output = analyzeCopadoStory("US-0000024", {
    spawnSync: mockSpawnSync
  });

  assert.equal(output.report.decision, "HOLD");

  assert.equal(
    output.releasePassport.impactAssessment.status,
    "NOT_ASSESSED"
  );

  assert.equal(
    output.releasePassport.impactAssessment.changedComponents,
    null
  );

  assert.equal(
    output.releasePassport.impactAssessment.impactedComponents,
    null
  );

  assert.equal(
  output.releasePassport.analysisScope.liveMetadataRetrieved,
  false
);

  assert.equal(
    output.releasePassport.analysisScope.deploymentTriggered,
    false
  );

  assert.match(output.markdown, /Release Passport/);
  assert.match(output.markdown, /NOT ASSESSED/);
  assert.match(output.markdown, /not deployment approval/i);
  assert.match(output.markdown, /Not run evidence: Story status/i);
});
