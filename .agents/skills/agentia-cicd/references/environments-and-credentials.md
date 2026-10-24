<!-- Agentia managed skill file: agentia setup skills -->

# CICD Environments And Credentials Reference

Use this reference for `agentia cicd environment ...`, `agentia cicd environment auth ...`, and `agentia cicd credential ...`.

`auth set --cicd` stores the API key used by the CLI. `cicd credential` lists, creates, or updates Copado environment credential records. They are different credential types.

## Environment Commands

| Command | Use For | Notes |
| --- | --- | --- |
| `environment list` | Find environments | Filter by `--name`, `--org-id`, `--platform`, `--type`, cursor, and page size. |
| `environment get ID` | Inspect one environment | Read before updates, credential changes, or auth checks. |
| `environment create NAME` | Create an environment | Set `--type`; platform defaults to SFDX. |
| `environment update ID` | Sparse environment changes | Use only the fields the user wants changed. |
| `environment open [ID]` | Open environment or credential | `--credentialid` opens a credential. CLI-only navigation helper. |
| `environment auth status ID` | Validate org credential auth | Use `--credentialid` when multiple credentials need disambiguation. |
| `environment auth web login ID` | Complete browser OAuth login | CLI-only, interactive browser flow. Supports bounded port and timeout flags. |

Examples:

```sh
agentia cicd environment list --type Sandbox --json
agentia cicd environment get <environment-id> --json
agentia cicd environment auth status <environment-id> --credentialid <credential-id> --json
```

## Environment Credential Commands

| Command | Use For | Notes |
| --- | --- | --- |
| `credential list` | Find credentials in one environment | Requires `--environmentid`; returns the environment's embedded credentials. OAuth signatures are never returned. |
| `credential create` | Create a Copado environment credential | Requires `--environmentid` and `--name`; `--default` marks it default. |
| `credential update ID` | Update a Copado environment credential | Requires `--environmentid`; use `--default` or `--no-default`. |

Examples:

```sh
agentia cicd credential list --environmentid <environment-id> --json
agentia cicd credential create --environmentid <environment-id> --name "CI User" --default --json
agentia cicd credential update <credential-id> --environmentid <environment-id> --no-default --json
```

## When To Use Which Credential

- Use `agentia auth set --cicd` when the CLI cannot authenticate to the Copado CICD API.
- Use `agentia cicd credential list` to inspect an environment's credential records before changing authentication or defaults.
- Use `agentia cicd credential create/update` when a Copado environment needs a Salesforce org credential record.
- Use `agentia cicd environment auth web login` when a credential exists but needs browser-based OAuth authentication.
- Use `agentia auth get --cicd --json` to inspect local CLI auth status without exposing the raw API key.

## Gotchas

- Custom Domain environments are not supported by the credential create/update helpers.
- The credential helper reads the environment first and copies its org type into the credential payload.
- Environment authentication can auto-select only when there is a single obvious credential. Pass `--credentialid` if multiple credentials exist.
- Browser login is intentionally CLI-only; there is no equivalent MCP flow.
