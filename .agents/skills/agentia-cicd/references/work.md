

# CICD Work Reference

Use this reference for `agentia cicd work ...` and matching MCP tools such as `agentia_work_get`, `agentia_work_commit`, `agentia_work_publish`, and `agentia_work_submit`.

## Choose One Workflow

Local and cloud work are separate delivery paths. Do not continue a cloud commit with local `work publish` or `work submit`: those commands inspect and push the local Git feature branch.

### Local Repository Flow

Use this path when the change exists in the local repository:

1. Discover and inspect: `agentia cicd work list --assigned-to-me --json`, then `agentia cicd work get <id-or-name> --json`.
2. Activate: `agentia cicd work set <id-or-name> --json`. This fetches the configured base branch, fetches the Story feature branch when it exists on origin, then checks out `feature/<story-name>` from that remote branch when present (otherwise from the base), and records the story, base branch, dev org branch, and pull-request context in `.agentia/config.user.json`. Use `--base-branch <branch>` only when intentionally overriding the Pipeline default. If the JSON result has `status: "warning"` (missing pipeline or credential), show that `message`, do not assume a feature branch was created, and stop until the Story setup is fixed — publish and submit will not work. If the Story source credential differs from the project default, work set warns with the current credential and environment and does not PATCH; use `agentia cicd work update <id> --source-credential <credential-id>` to change it.
3. Implement with Salesforce CLI, VS Code, or an IDE. Stage and commit with `git add` / `git commit`. Do not use `agentia cicd work commit` for local Git work.
4. Run project-owned gates: `agentia cicd work test --json`. This runs `.agentia_quality_gates.sh` or `.agentia_quality_gates.cmd` from the repository root when present. If those files are missing, it warns and runs `agentia cicd work test apex` via the stock sample from a temporary file. Local tests can be slow; pass `--apex-test-classes=MyTest,OtherTest` for faster, earlier Apex checks.
5. Register and synchronize: `agentia cicd work publish --json`. A plain `git push` does not register a Copado Commit or merge the feature branch into the recorded dev org branch. Pass `--permissions` and `--full-metadata` when nested detection is not enough.
6. Validate and open the merge-request flow: `agentia cicd work submit --json`. Submit runs the local gates unless `--skip-local-tests` is explicit, pushes ahead commits, waits if the last pending related job is a Commit template, and submits with validate-only behavior. `--skip-pull-request` skips opening the compare URL.
7. Only with explicit approval to promote and deploy, run `agentia cicd work submit --deploy --json` (or `--done`). `work done` is a compatibility alias.
8. Check asynchronous results with `agentia cicd work status [id-or-name] --json`.

`work set`, `work publish`, and `work submit` require a clean tracked working tree. `work publish` also requires the exact `feature/<story-name>` branch, recorded `lastBaseBranch` and `lastDevOrgBranch`, and at least one commit in `origin/<lastBaseBranch>..HEAD`. `work submit` fetches `origin/<lastBaseBranch>` and permits an empty commit range only for a Story with a Salesforce Data Set or Data Template deployment step.

### Copado Cloud Flow

Use this path when Copado should retrieve metadata from a configured source environment instead of using local Git changes:

1. Inspect the Story and pass its Salesforce ID explicitly when possible. An active Story from `work set` is optional, not a prerequisite for the cloud operation.
2. Start a cloud commit with `agentia cicd work commit <story-id> --cloud ... --json`. Use the simple metadata flags for one change, or `--file`/`--stdin` for a multi-change request. Salesforce metadata requires `--metadata-category SFDX`.
3. Let the command wait for its Job Execution by default. After a timeout, use the returned execution ID with `agentia cicd job get` and `agentia cicd job log get`; do not immediately submit a duplicate commit.
4. When explicitly approved to promote an existing Promotion, use `agentia cicd work promote <story-id> --cloud --json`; add `--deploy` only for promote-and-deploy. This is independent of local `work submit`.

Cloud commit checks Story readiness and source credentials before submission. Avoid concurrent cloud commits to one Story. Treat `--recreate-feature-branch` as destructive because it can overwrite Story-branch work.

## Core Commands


| Command            | Use For                                        | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `work list`        | Find candidate stories                         | Use `--assigned-to-me`, `--status`, `--project-name`, `--name`, pagination flags.                                                                                                                                                                                                                                                                                                                                                                                                                    |
| `work get [ID]`    | Read story details                             | ID is optional after `work set`. Human output redacts OAuth signatures; JSON preserves structured fields.                                                                                                                                                                                                                                                                                                                                                                                            |
| `work create`      | Create a story                                 | Use `--title`, project/team/assignee/theme fields, specs, and short acceptance criteria. `--source-credential` sends `sourceEnvironment` as null so Salesforce assigns the environment.                                                                                                                                                                                                                                                                                                              |
| `work update [ID]` | Mutate story fields or status                  | ID is optional after `work set`. Acceptance criteria must be fewer than 255 chars. `--source-credential` sends `sourceEnvironment` as null.                                                                                                                                                                                                                                                                                                                                                          |
| `work set ID`      | Mark active and prepare branch                 | Fetches the base branch and, when present, the remote feature branch; creates/checks out `feature/<story-name>` from `origin/feature` when that ref exists, otherwise from the base; stores local context. A gateway warning prints the message and skips git. Warns without PATCHing when the Story credential differs from the project default; use `work update --source-credential` to change it. `--none` clears every `last*` key and checks out `lastBaseBranch`, else `main`, else `master`. |
| `work commit`      | Copado cloud metadata commit                   | Requires `--cloud`. For local Git work, use `git commit` then `work publish`.                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `work publish`     | Publish local commits and register with Copado | Requires active story context and clean tree. Accepts `--permissions` and `--full-metadata` when nested detection is not enough. `work push` is a compatibility alias.                                                                                                                                                                                                                                                                                                                               |
| `work test`        | Run local quality gate scripts                 | `--local` is default. Runs `.agentia_quality_gates.sh` or `.agentia_quality_gates.cmd` from repo root. If missing, warns and runs the stock setup sample from a temp file. `--cloud` is not implemented yet.                                                                                                                                                                                                                                                                                         |
| `work test apex`   | Run named Apex test classes                    | Required `--apex-test-classes`. Optional `--wait` minutes (default 60). Usually invoked from `.agentia_quality_gates.*` when local quality gates are configured.                                                                                                                                                                                                                                                                                                                                     |
| `work submit`      | Submit for review/validation or promote        | Runs local gates unless `--skip-local-tests`; can push ahead commits. Waits up to 5 minutes when the last pending related job template contains `Commit`. `--skip-pull-request` skips opening the MR URL. `--done` and `--deploy` match Copado UI Submit when promoting.                                                                                                                                                                                                                             |
| `work done`        | Compatibility alias                            | Prefer `work submit --done`; both promote and deploy rather than validate-only.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| `work promote`     | Story-centric promotion run                    | Requires `--cloud`; use `--deploy` for merge and deploy.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `work status [ID]` | Check story and related executions             | Useful after submit, promote, or commit jobs.                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `work open [ID]`   | Open story in browser                          | CLI-only browser helper.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |




## Local Repository Details

Use Git for normal source changes:

```sh
git add -A
git commit -m "US-0001 add account service"
agentia cicd work test --json
agentia cicd work publish --permissions CustomField:Account.SLA__c,ApexClass:AccountService --json
agentia cicd work submit --json
```

`--permissions` on publish names metadata that Copado should treat as Retrieve Only. List the components whose access changed, not the permission set or profile files; naming those parent types is rejected. Use `--full-metadata` only for `Profile`, `PermissionSet`, `MutingPermissionSet`, `CustomObject`, or `CustomObjectTranslation` when that complete file should travel; other types are rejected. Both flags apply to that publish only.

`work test` and `work submit` take `--apex-test-classes` when you want the local gate script to receive them as `AGENTIA_APEX_TEST_CLASSES`. Sample quality-gate scripts pass that value to `work test apex`.

`work publish` detects nested metadata across the full branch diff from the merge base to `HEAD`, applies Copado environment-variable and YAML replacements, registers every commit in the range, and merges into the recorded dev org branch. Review unexpected Retrieve Only, Full Metadata, or nested-deletion output before continuing.

## Cloud Operation Details

Use cloud commits when Copado should retrieve metadata itself:

```sh
agentia cicd work commit <story-id> --cloud --message "Commit AccountService" --metadata-name AccountService --metadata-type ApexClass --metadata-category SFDX --json
agentia cicd work commit <story-id> --cloud --file commit-request.json --json
```

For Salesforce metadata, include `--metadata-category SFDX`. Without the SFDX category, Copado deploy logs can report "Salesforce changes not found."

For a cloud promotion, the Story must already belong to a Promotion:

```sh
agentia cicd work promote <story-id> --cloud --json
agentia cicd work promote <story-id> --cloud --deploy --json
```

Cloud commit and promotion wait for Job Executions by default and return nonzero on failed or timed-out jobs while preserving diagnostic IDs. If a Promotion reaches Merge Conflict, resolve it and resume the original execution; do not start a replacement run.

## Deployment Steps

Deployment steps are attached to a user story and run during promotion.


| Command                                 | Use For                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `work deployment-step types`            | List supported standard/custom step types.                                                        |
| `work deployment-step salesforce-flows` | List directly invocable Salesforce Flows.                                                         |
| `work deployment-step list`             | Inspect current story steps.                                                                      |
| `work deployment-step create`           | Add Manual Task, Salesforce Flow, Function, Apex, Data Set, Data Template, or Robotic Test steps. |
| `work deployment-step update`           | Apply sparse step updates.                                                                        |
| `work deployment-step reorder`          | Submit a complete before/after ordering snapshot from file or stdin.                              |
| `work deployment-step delete`           | Delete an owned step by ID.                                                                       |


Prefer explicit flags for standard step types. Use `--config-json`, `--file`, or `--stdin` only when the step has expert configuration not covered by flags. Read `types` first when unsure.

## Gotchas

- `work test` is not CRT. For Robot Framework execution, use the `agentia-testing` skill.
- `work test apex` runs named Apex classes. Local quality gates (`.agentia_quality_gates.*`) usually call it when `AGENTIA_APEX_TEST_CLASSES` is set. Direct use is for a targeted rerun without the rest of the gates.
- Local Git work uses `git commit` then `work publish`. Cloud `work commit --cloud` is a separate path.
- `work submit` may push ahead commits, but the local flow still needs story and branch context from `work set`.
- `work submit --done` (or `--deploy`) promotes/deploys. Do not run it unless the user explicitly asked to promote or finish the story.
- `work promote --cloud` is not the next step after a local git commit; local delivery uses `work publish` and `work submit`.
- `work delete` is destructive; read the story and confirm intent first.
