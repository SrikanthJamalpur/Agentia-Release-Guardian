---
name: release-guardian
description: Safely analyze Salesforce release scenarios, run local quality checks, generate release evidence reports, and explain GO, HOLD, or BLOCK decisions. Use when working on Agentia Release Guardian or reviewing its demo reports.
---

# Agentia Release Guardian

## Purpose
Help the user demonstrate explainable Salesforce release-risk analysis and evidence reporting. The current implementation analyzes local JSON fixture data. Do not claim that it retrieves Salesforce metadata, runs Salesforce tests, deploys changes, or approves releases unless those capabilities are independently implemented and verified.

## Required workflow
1. Work from the repository root unless a command explicitly requires the `release-guardian` directory.
2. Run the local test suite:
   `npm --prefix .\release-guardian test`
3. If tests pass, generate the demo reports:
   `npm --prefix .\release-guardian run guardian`
4. Inspect the generated files:
   - `release-guardian\reports\release-guardian-report.json`
   - `release-guardian\reports\release-guardian-report.md`
5. Explain each scenario's decision, risk score, impacted components, dependency paths, evidence status, and recommended action. Base explanations on the actual generated report.
6. If a test fails or report generation fails, report the actual error and investigate before claiming success.

## Decision interpretation
- GO means the local analysis found acceptable risk and complete recognized passing evidence for that fixture. It is not release authorization.
- HOLD means evidence is missing, not run, or unrecognized, or the risk score meets the configured HOLD threshold.
- BLOCK means required evidence failed or the configured BLOCK threshold was reached.
- Explain the reasons and evidence behind the decision; never present the score alone as proof of release safety.
- The configured scoring is illustrative and must not be described as a universal Salesforce release standard.

## Copado and Agentia safety
- Copado context checks must be read-only unless the user explicitly requests a change and confirms the exact target and action.
- Before any proposed change, inspect the target record and explain the intended effect.
- Never execute promotions, deployments, environment changes, credential changes, or other mutating CI/CD actions as part of the routine demo.
- Do not create environments or credentials merely to make the demo look integrated.
- Do not expose passwords, API keys, PAKs, OAuth signatures, tokens, or other secrets in reports or chat.
- An authenticated Copado environment does not prove that this project is connected to live Salesforce metadata or that release operations have run.
- Clearly distinguish verified Copado API context from local fixture analysis.

## Reporting
For every run, state:
- The exact command executed.
- Whether tests passed.
- Whether report generation succeeded.
- The decisions and evidence actually present in the generated reports.
- Any limitations or manual steps still required.

Never fabricate results, integrations, test executions, approvals, or metrics.

## Copado story review

When a Copado story review is requested:

1. Run `npm --prefix .\release-guardian run guardian -- --copado US-0000024`, replacing the example story ID with a user-provided or verified story ID.
2. Inspect `release-guardian/reports/copado-release-guardian-report.json` and `release-guardian/reports/copado-release-guardian-report.md`.
3. Treat the result as a read-only review of allowlisted Copado story context.
4. Clearly report missing or unverified job, test, and impact evidence.
5. Do not infer zero impact from unavailable component data, or claim that tests passed, deployment occurred, or release approval was granted.
