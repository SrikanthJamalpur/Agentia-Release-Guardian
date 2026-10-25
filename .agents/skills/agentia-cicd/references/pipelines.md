<!-- Agentia managed skill file: agentia setup skills -->

# CICD Pipelines Reference

Use this reference for `agentia cicd pipeline ...`, `agentia cicd pipeline connection ...`, `agentia cicd pipeline stage-connection ...`, and `agentia cicd stage ...`.

Pipeline connections, stage connections, and stages are related but distinct. Read the target object before mutating it.

## Pipeline Commands

| Command | Use For | Notes |
| --- | --- | --- |
| `pipeline list` | Find pipelines | Filter by `--active`, `--name`, `--platform`, cursor, and page size. |
| `pipeline get ID` | Inspect one pipeline | Returns describe-style details, including embedded connections. |
| `pipeline create NAME` | Create a pipeline | Common flags: `--platform`, `--main-branch`, `--git-repository-id`. |
| `pipeline update ID` | Sparse pipeline changes | Set `--name`, branch, repository, or conflict strategy fields. |
| `pipeline open ID` | Open in browser | CLI-only navigation helper. |

Example:

```sh
agentia cicd pipeline list --platform SFDX --active --json
agentia cicd pipeline get <pipeline-id> --json
```

## Environment Connections

Pipeline connections define source-to-destination environment promotion edges.

| Command | Use For |
| --- | --- |
| `pipeline connection list --pipeline-id <id>` | List environment edges in a pipeline. |
| `pipeline connection create --pipeline-id <id> ...` | Create one edge or pass a JSON file for bulk creation. |
| `pipeline connection update --pipeline-id <id> ...` | Update one edge or pass a JSON file for bulk update. |
| `pipeline connection delete --pipeline-id <id> ... --yes` | Delete one or more edges. |
| `pipeline connection open ID` | Open one connection in the browser. |

Single-create example:

```sh
agentia cicd pipeline connection create --pipeline-id <pipeline-id> --source-environment-id <dev-id> --destination-environment-id <uat-id> --branch main --json
```

## Stages And Stage Connections

Stages are reusable stage records. Stage connections order those stages inside a pipeline.

| Command | Use For |
| --- | --- |
| `stage list|get|create|update|delete|open` | Manage stage records. |
| `pipeline stage-connection list --pipeline-id <id>` | Read ordered stages for a pipeline. |
| `pipeline stage-connection create --pipeline-id <id> --stage-id <id>` | Add a stage to a pipeline chain. |
| `pipeline stage-connection update ID --pipeline-id <id>` | Rewire the next stage connection. |
| `pipeline stage-connection delete ID --pipeline-id <id> --yes` | Remove a stage connection. |
| `pipeline stage-connection open ID` | Open the stage connection in a browser. |

## Gotchas

- `pipeline connection` is an environment promotion edge.
- `pipeline stage-connection` is the ordered stage chain inside a pipeline.
- `cicd stage` manages stage records that can be referenced by stage connections.
- Delete commands prompt in interactive mode. Use `--yes` only when the user already confirmed the destructive action.
- Repository setup is a neighboring domain: pipelines can reference `--git-repository-id`, but repository lifecycle commands are under `agentia cicd repository`.
