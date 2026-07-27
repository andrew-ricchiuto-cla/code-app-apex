# Dataverse Authentication Runbook

Last validated: 2026-07-27

## Decision

Device-code authentication is not supported by this tenant and must not be used
as a fallback.

For local Python development, use a tenant-pinned `AzureCliCredential` with a
30-second process timeout. If an explicit interactive fallback is needed, use
`InteractiveBrowserCredential`, also pinned to the tenant. For unattended
automation, use `ClientSecretCredential`.

PAC authentication remains separate. A working PAC profile authenticates PAC
commands, but it does not provide a credential to Python's `DataverseClient`.

The local-development credential order is:

1. `ClientSecretCredential` when both `CLIENT_ID` and `CLIENT_SECRET` are set.
2. `AzureCliCredential(tenant_id=TENANT_ID, process_timeout=30)`.
3. `InteractiveBrowserCredential(tenant_id=TENANT_ID)`.
4. Stop with an actionable error. Never fall through to device code.

## What is verified

| Pattern | Status | Evidence and decision |
| --- | --- | --- |
| `AzureCliCredential` | **Live-verified against ApexSimulation** | On 2026-07-27, a tenant-pinned `AzureCliCredential` completed a read-only Dataverse SDK query for the confirmed `ApexSimulation` solution. The working local implementation pattern is also present in `C:\Users\ricc55955\projects\bloc-mgmt\scripts\auth.py:20-32`. Use `process_timeout=30`; the Azure Identity default of 10 seconds timed out once locally, while a warmed direct Azure CLI token request completed in about four seconds. |
| `InteractiveBrowserCredential` | **Implemented and selection-tested; configured for this tenant** | `C:\Users\ricc55955\projects\pf-auto\scripts\auth.py:86-90` selects an auth mode, and lines 143-148 construct the tenant-pinned browser credential. `C:\Users\ricc55955\projects\pf-auto\tests\test_auth.py:53-77` verifies that `AUTH_MODE=interactive_browser` selects it. This is a valid user-interactive fallback, but it was not live-tested during the 2026-07-27 validation. |
| `ClientSecretCredential` | **Implemented; not live-tested in this session** | Apex already constructs it when both client settings exist at `scripts/auth.py:105-116`. The same pattern is used in `C:\Users\ricc55955\projects\pf-auto\scripts\auth.py:115-120`. Keep it for CI and other non-interactive execution after the app registration and Dataverse application user are configured. |
| PAC browser authentication | **Works for PAC only** | The first-party setup instructions define browser-based PAC auth at `C:\Users\ricc55955\.codex\skills\dv-connect\references\tools-setup.md:90-102`. The Apex profile commands are recorded in `AGENTS.md:8-14`. Use this for solution and Code App CLI commands, not as a Python credential. |
| `DefaultAzureCredential` | **Available, not locally proven for this app** | No Apex or nearby working-project script uses it. Its broad chain makes the selected identity less obvious in a multi-tenant developer workstation. Do not make it the Apex default without a separate live validation and explicit exclusions. |
| Dataverse CLI shared-cache adapter | **Available in another first-party plugin version; not approved for Apex** | `C:\Users\ricc55955\.claude\plugins\cache\claude-plugins-official\dataverse\1.6.0\scripts\auth.py:4-16` documents sharing the `dataverse auth create` cache, and lines 236-244 implement the adapter. This is the **Dataverse CLI** cache, not PAC's cache. Current Codex Dataverse guidance explicitly forbids reading raw token-cache files at `C:\Users\ricc55955\.codex\skills\dv-overview\SKILL.md:92-100`, so do not copy this implementation into Apex unless that guidance is updated. |
| `DeviceCodeCredential` | **Known incompatible** | This tenant rejects the device-code path. Apex currently falls into it at `scripts/auth.py:117-143`; that is the present blocker and should be replaced by the local-development chain above. |

## Python helper contract

All Dataverse scripts should import one shared helper instead of choosing a
credential independently:

```python
from azure.identity import (
    AzureCliCredential,
    ChainedTokenCredential,
    ClientSecretCredential,
    InteractiveBrowserCredential,
)


def get_credential():
    # load_env() and validate TENANT_ID + DATAVERSE_URL first
    if client_id and client_secret:
        return ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
        )

    return ChainedTokenCredential(
        AzureCliCredential(
            tenant_id=tenant_id,
            process_timeout=30,
        ),
        InteractiveBrowserCredential(tenant_id=tenant_id),
    )
```

Treat a partially configured service principal as an error. Do not silently
fall back when only one of `CLIENT_ID` or `CLIENT_SECRET` is present.

The token scope remains:

```text
{DATAVERSE_URL}/.default
```

Pass the credential directly to the SDK:

```python
client = DataverseClient(
    base_url=os.environ["DATAVERSE_URL"],
    credential=get_credential(),
)
```

Never print the token. In particular, do not execute the current Apex
`scripts/auth.py` as a standalone program until its `__main__` block is changed:
the current implementation prints the raw token.

## Preflight for future sessions

Before the first operation against an environment:

1. Show the intended `DATAVERSE_URL` and solution name to the user and obtain
   explicit confirmation.
2. Confirm Azure CLI is signed into the same tenant as `TENANT_ID`. If it is
   not, use browser-based `az login --tenant <TENANT_ID>`.
3. Verify Python authentication with a read-only SDK query. Report only the
   environment and success/failure; never log the token.
4. For PAC operations, separately select the named profile and verify it:

   ```powershell
   pac auth select --name apex
   pac org who
   ```

5. Only after both checks point to the confirmed environment should a metadata
   or solution mutation run.

The environment-confirmation requirement comes from
`C:\Users\ricc55955\.codex\skills\dv-connect\references\tools-setup.md:58-72`
and the PAC verification sequence is at lines 98-111.

## Why PAC is not the Python solution

The current Dataverse guidance assigns `pac auth create` to PAC CLI and
`scripts/auth.py` to Python/SDK authentication
(`C:\Users\ricc55955\.codex\skills\dv-overview\SKILL.md:92-102`). The Apex
configuration key `PAC_AUTH_PROFILE` is useful for selecting PAC state, but the
current Python helper does not consume PAC's profile or token cache.

Therefore:

- `pac org who` proves the target for PAC commands.
- `AzureCliCredential` or another Azure Identity credential proves Python SDK
  access.
- Success in one does not imply success in the other.

## Local evidence index

- Working Azure CLI/browser chain:
  `C:\Users\ricc55955\projects\bloc-mgmt\scripts\auth.py:4-32`
- Browser mode and service-principal implementation:
  `C:\Users\ricc55955\projects\pf-auto\scripts\auth.py:71-160`
- Browser credential selection test:
  `C:\Users\ricc55955\projects\pf-auto\tests\test_auth.py:53-77`
- Apex's current device-code fallback:
  `scripts/auth.py:69-145`
- PAC profile procedures:
  `AGENTS.md:8-21`
- First-party PAC authentication guidance:
  `C:\Users\ricc55955\.codex\skills\dv-connect\references\tools-setup.md:56-111`
- Current first-party auth constraints:
  `C:\Users\ricc55955\.codex\skills\dv-overview\SKILL.md:92-102`
- First-party Dataverse CLI shared-cache reference, not adopted:
  `C:\Users\ricc55955\.claude\plugins\cache\claude-plugins-official\dataverse\1.6.0\scripts\auth.py:4-16,86-99,227-248`
