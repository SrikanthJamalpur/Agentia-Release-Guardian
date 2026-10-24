<!-- Agentia managed skill file: agentia setup skills -->

# CICD Promotions Reference

Use this reference for `agentia cicd promotion ...`, `agentia cicd promotion conflict ...`, and `agentia cicd work promote`.

## Entry Points

| Command | Starts From | Use When |
| --- | --- | --- |
| `agentia cicd promotion run <promotion-id>` | Promotion ID | You already know the Promotion record and want explicit merge or merge-and-deploy control. |
| `agentia cicd work promote [story-id] --cloud` | User Story | You want Agentia to resolve the story's Promotion before running it. |
| `agentia cicd work submit --done` | Active User Story branch | The story is approved and should move to the next stage (Copado UI Submit promote). |

Prefer `work promote` when the user talks about a story. Prefer `promotion run` when the user provides a Promotion ID.

## Promotion Commands

| Command | Use For | Notes |
| --- | --- | --- |
| `promotion list` | Find promotions | Filter by `--work-id`, status, project, pipeline, source/destination environment, or back-promotion flags. |
| `promotion get ID` | Inspect one promotion | Read this before running, resuming, or resolving conflicts. |
| `promotion run ID` | Preflight and submit a run | Requires `--operation merge` or `--operation merge_and_deploy` unless `--resume` is used. |
| `promotion open ID` | Open in browser | CLI-only navigation helper. |
| `work promote [ID] --cloud` | Story-centric run | Use `--deploy` for merge and deploy; use `--promotion-id` if the story has multiple promotions. |

Example:

```sh
agentia cicd promotion list --work-id <story-id> --json
agentia cicd promotion run <promotion-id> --operation merge_and_deploy --json
agentia cicd work promote <story-id> --cloud --deploy --json
```

## Resume And Wait

`promotion run` and `work promote` can poll job execution status. Use the default wait for normal agent workflows and lower it only when the user wants a fire-and-follow-up flow.

Use `--resume <job-execution-id>` to resume the original execution after conflict resolution instead of starting a new `/run` request.

## Conflict Commands

| Command | Use For |
| --- | --- |
| `promotion conflict list -p <promotion-id>` | List merge conflicts for a promotion. |
| `promotion conflict get <conflict-id> -p <promotion-id>` | Fetch raw conflict content; use `--output` to write a file. |
| `promotion conflict resolve <conflict-id> -p <promotion-id> --mode auto` | Let Copado apply automatic resolution. |
| `promotion conflict resolve <conflict-id> -p <promotion-id> --mode manual --file <path>` | Submit reviewed manual content. |
| `promotion conflict unresolve <conflict-id> -p <promotion-id>` | Undo a prior resolution. |

Read conflict content before manual resolution. Do not invent resolved content; use the user's reviewed file or ask for confirmation.

## Gotchas

- Promotion IDs are not User Story IDs. Use `work promote` if you only have the story.
- `--deploy` on `work promote` maps to promotion operation `merge_and_deploy`; without it, the default is merge only.
- `--recreate-promotion-branch` is a sensitive run option and should be paired with explicit user intent and `--yes` when required.
- If conflicts exist, resolve them first and then resume the same execution.
