"""
auth.py — Acquire Dataverse tokens via Azure Identity.

Auth priority:
  1. Service principal (CLIENT_ID + CLIENT_SECRET in .env) - non-interactive
  2. Azure CLI credential pinned to TENANT_ID - local development
  3. Interactive browser credential pinned to TENANT_ID - local fallback

Device-code authentication is intentionally unsupported because the target
tenant's Conditional Access policy rejects that flow.

Functions:
  load_env()            — loads .env into os.environ
  get_credential()      — returns a TokenCredential for use with DataverseClient
  get_token(scope=None) — returns a raw access token string

Usage:
    # PREFERRED — use the Python SDK for all supported operations:
    from auth import get_credential, load_env
    from PowerPlatform.Dataverse.client import DataverseClient
    load_env()
    client = DataverseClient(os.environ["DATAVERSE_URL"], get_credential())

    # ONLY for operations the SDK does NOT support (forms, views, $ref, $apply):
    from auth import get_token, load_env
    token = get_token()

Reads from .env in the repo root (parent of scripts/) or current working directory:
    DATAVERSE_URL      — required
    TENANT_ID          — required
    CLIENT_ID          — optional, enables service principal auth
    CLIENT_SECRET      — optional, enables service principal auth
"""

import os
import sys
from pathlib import Path

def load_env():
    """Load key=value pairs from .env into os.environ (does not overwrite existing vars).

    Searches for .env in two locations (first match wins):
      1. The repo root (parent of the directory containing this script)
      2. The current working directory
    This ensures ``cd scripts && python auth.py`` works the same as
    ``python scripts/auth.py`` from the repo root.
    """
    script_dir = Path(__file__).resolve().parent
    candidates = [script_dir.parent / ".env", Path(".env")]
    env_path = next((p for p in candidates if p.exists()), None)
    if env_path is not None:
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, _, value = line.partition("=")
                os.environ.setdefault(key.strip(), value.strip())


_credential = None


def get_credential():
    """
    Return an Azure Identity TokenCredential, creating one on first call.

    The credential is cached for the lifetime of the process. Uses
    ClientSecretCredential when CLIENT_ID + CLIENT_SECRET are set. Otherwise,
    use AzureCliCredential first and InteractiveBrowserCredential as fallback.
    """
    global _credential
    if _credential is not None:
        return _credential

    load_env()

    tenant_id = os.environ.get("TENANT_ID")
    dataverse_url = os.environ.get("DATAVERSE_URL", "").rstrip("/")
    client_id = os.environ.get("CLIENT_ID")
    client_secret = os.environ.get("CLIENT_SECRET")

    if not tenant_id or not dataverse_url:
        missing = [k for k, v in [("TENANT_ID", tenant_id), ("DATAVERSE_URL", dataverse_url)] if not v]
        print(f"ERROR: .env is missing required values: {', '.join(missing)}", flush=True)
        print("  Run the init sequence (/dataverse:init) to create .env.", flush=True)
        sys.exit(1)

    try:
        from azure.identity import (
            AzureCliCredential,
            ChainedTokenCredential,
            ClientSecretCredential,
            InteractiveBrowserCredential,
        )
    except ImportError:
        print("ERROR: azure-identity not installed. Run: pip install --upgrade azure-identity", flush=True)
        sys.exit(1)

    if bool(client_id) != bool(client_secret):
        raise ValueError(
            "CLIENT_ID and CLIENT_SECRET must be configured together."
        )

    # Path 1: Service principal (non-interactive)
    if client_id and client_secret:
        _credential = ClientSecretCredential(
            tenant_id=tenant_id,
            client_id=client_id,
            client_secret=client_secret,
        )
    else:
        _credential = ChainedTokenCredential(
            AzureCliCredential(
                tenant_id=tenant_id,
                process_timeout=30,
            ),
            InteractiveBrowserCredential(tenant_id=tenant_id),
        )

    return _credential


def get_token(scope=None):
    """
    Acquire a raw access token string for the Dataverse environment.

    :param scope: OAuth2 scope. Defaults to "{DATAVERSE_URL}/.default".
    :returns: Access token string suitable for a Bearer Authorization header.
    """
    load_env()
    dataverse_url = os.environ.get("DATAVERSE_URL", "").rstrip("/")
    if not scope:
        scope = f"{dataverse_url}/.default"

    credential = get_credential()

    try:
        token = credential.get_token(scope)
    except Exception as e:
        print(f"ERROR: Failed to acquire access token: {e}", flush=True)
        print("  Check your network connection, credentials, and .env configuration.", flush=True)
        sys.exit(1)

    return token.token


def main():
    token = get_token()
    load_env()
    print(
        f"Dataverse token acquired for {os.environ['DATAVERSE_URL']} "
        f"({len(token)} chars)"
    )


if __name__ == "__main__":
    main()
