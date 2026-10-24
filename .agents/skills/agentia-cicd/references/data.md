<!-- Agentia managed skill file: agentia setup skills -->

# CICD Data Reference

Use this reference for Release Data Template commands under `agentia cicd data ...`.

Data commands often accept large JSON bodies. Prefer `--file` or `--stdin` for complex payloads and `--json` for machine-readable responses.

## Operating Rules

- Read the target template, credential, User Story, or data commit before mutating it.
- Use IDs returned by Copado. Do not infer template, credential, commit, or ContentVersion IDs.
- Use `data sobject fields` and `data sobject relationships` before constructing payloads that reference Salesforce fields or relationships.
- For JSON payload commands, use exactly one input source: inline JSON flags, `--file`, or `--stdin`.
- Prefer `--file` when a payload should be reviewed, edited, or reused. Prefer `--stdin` for generated, one-use payloads.
- After every mutation, read the affected resource back or run its corresponding `list` command.

## Choose A Workflow

| Intent | Workflow |
| --- | --- |
| Find or export an existing template | Inspect A Template |
| Test source records and destination matching | Validate Records And Matching |
| Update templates after metadata changes | Synchronize Metadata Changes |
| Attach data to a User Story and inspect generated files | Create A Data Commit |
| Convert or remove a template | Legacy Conversion And Deletion |

## Inspect A Template

1. Discover candidates with `data template list --json`.
2. Inspect the selected-column graph with `data template get <template-id> --json`.
3. Use `data template get-detail <template-id> --json` only when raw v2 configuration is needed for editing or troubleshooting.
4. Inspect attached filters and formulas with `data filter list` and `data formula list` when relevant.

Finish when the correct template and its current configuration have been identified. Keep `get-detail` output as a baseline before changing template detail.

## Validate Records And Matching

1. Inspect the template and source/destination credentials.
2. Search representative source records with `data records search`.
3. Match selected source records against the destination with `data records match`.
4. Review unmatched or ambiguous results.
5. Adjust filters or formulas when needed, then repeat the search and match checks.

Treat this as a feedback loop. Finish when representative records produce the intended source selection and destination matches.

## Synchronize Metadata Changes

1. Prepare the metadata-change request in a JSON file.
2. Run `data sync preview-updates --file <preview-request> --json`.
3. Review every preview entry, especially `needsAttention` and `autoUpdate`.
4. Build an apply payload containing only approved sync entries.
5. Run `data sync apply --file <sync-entries> --json`.
6. Read each affected template back to verify its fields and relationships.

Never apply preview results without reviewing them first. Stop for user input when an entry needs attention and the intended field change is unclear.

## Create A Data Commit - Full template

1. Resolve and inspect the target User Story; see [work.md](work.md).
2. Inspect the selected template and credentials.
3. Prepare the data commit request in a JSON file.
4. Run `data commit create --file <commit-request> --json`.
5. If the response contains a JobExecution ID, inspect and monitor it using [jobs.md](jobs.md).
6. Confirm the commit is attached to the intended story with `data commit list <user-story-id> --json`.
7. List generated artifacts with `data dataset-file list <data-commit-id> --json`.
8. Fetch required content with `data dataset-file content <content-version-id>`.

Finish when the data commit belongs to the intended story, any returned job has reached the expected status, and generated dataset files are accounted for.

## Legacy Conversion And Deletion

1. Discover and inspect the exact template.
2. Save its `get` and `get-detail` output before conversion or deletion.
3. For legacy conversion, run `data template convert-old <template-id> --json`, then read the converted template back.
4. For deletion, confirm the target and destructive intent before running `data template delete <template-id> --json`.

## Template Commands

| Command | Use For | Notes |
| --- | --- | --- |
| `data template list` | Find templates | Filter by name, main object, active flag, and related records. |
| `data template get ID` | Export selected-column graph | Good for agent inspection and lightweight export. |
| `data template get-detail ID` | Get raw v2 detail | Use before editing or saving detail JSON. |
| `data template create` | Create a template | Requires credential, template/API name, and main object fields. |
| `data template save-detail ID` | Save v2 detail JSON | Use `--file` or `--stdin`. |
| `data template convert-old ID` | Convert legacy templates | Read current template first. |
| `data template delete ID` | Delete a template | Destructive; confirm target and intent. |
| `data template open ID` | Open in browser | CLI-only navigation helper. |

Example:

```sh
agentia cicd data template list --active --fetch-related --json
agentia cicd data template create --credential-id <credential-id> --template-name Accounts --api-name Accounts --main-object-api-name Account --main-object-label Account --json
```

## Records, Matching, Filters, And Formulas

| Command | Use For |
| --- | --- |
| `data records search` | Search source records for a template and credential. |
| `data records match` | Match source records to destination records from JSON input. |
| `data filter list/add/update/delete` | Manage advanced filters attached to a template. |
| `data formula list/create/update` | Manage record matching formulas, with up to three fields. |
| `data sobject fields` | Describe available fields for an sObject and credential. |
| `data sobject relationships` | Describe relationships for an sObject and credential. |
| `data sync preview-updates` | Preview data template field sync changes. |
| `data sync apply` | Apply data template field sync changes. |

Use describe commands before generating payloads that mention fields or relationships.

## Data Commits And Dataset Files

| Command | Use For |
| --- | --- |
| `data commit create` | Create a data commit on a User Story from JSON input. |
| `data commit list <user-story-id>` | List data commits attached to a story. |
| `data dataset-file list <data-commit-id>` | List generated dataset files. |
| `data dataset-file content <content-version-id>` | Fetch one dataset file's content. |

Example:

```sh
agentia cicd data commit list <user-story-id> --json
agentia cicd data dataset-file list <data-commit-id> --json
```

## Gotchas

- Template IDs, credential IDs, data commit IDs, and ContentVersion IDs are different values. Read the parent record before using child commands.
- `data template get` and `data template get-detail` serve different audiences: selected graph export versus raw v2 detail.
- `data template open` is CLI-only; MCP covers data operations but not browser navigation.
- A data commit can hand off to a CICD JobExecution. Continue with `agentia cicd job ...`, not CRT `agentia testing job ...`.
