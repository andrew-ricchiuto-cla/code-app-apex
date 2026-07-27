import importlib.util
import io
import os
import sys
import tempfile
import types
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch


AUTH_PATH = Path(__file__).resolve().parent / "auth.py"


class FakeCredential:
    def __init__(self, *credentials, **kwargs):
        self.credentials = credentials
        self.kwargs = kwargs

    def get_token(self, _scope):
        return types.SimpleNamespace(token="sensitive-token")


class FakeAzureCliCredential(FakeCredential):
    pass


class FakeChainedTokenCredential(FakeCredential):
    pass


class FakeClientSecretCredential(FakeCredential):
    pass


class FakeInteractiveBrowserCredential(FakeCredential):
    pass


def fake_identity_module():
    module = types.ModuleType("azure.identity")
    module.AzureCliCredential = FakeAzureCliCredential
    module.ChainedTokenCredential = FakeChainedTokenCredential
    module.ClientSecretCredential = FakeClientSecretCredential
    module.InteractiveBrowserCredential = FakeInteractiveBrowserCredential
    return module


def load_auth_module():
    spec = importlib.util.spec_from_file_location("auth_under_test", AUTH_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module._credential = None
    return module


class AuthCredentialSelectionTests(unittest.TestCase):
    def setUp(self):
        self.base_env = {
            "TENANT_ID": "tenant-id",
            "DATAVERSE_URL": "https://example.crm.dynamics.com/",
            "LOCALAPPDATA": tempfile.gettempdir(),
        }

    def test_uses_service_principal_when_both_credentials_are_configured(self):
        with patch.dict(
            os.environ,
            {
                **self.base_env,
                "CLIENT_ID": "client-id",
                "CLIENT_SECRET": "client-secret",
            },
            clear=True,
        ):
            with patch.dict(sys.modules, {"azure.identity": fake_identity_module()}):
                auth = load_auth_module()
                credential = auth.get_credential()

        self.assertIsInstance(credential, FakeClientSecretCredential)
        self.assertEqual(
            credential.kwargs,
            {
                "tenant_id": "tenant-id",
                "client_id": "client-id",
                "client_secret": "client-secret",
            },
        )

    def test_uses_tenant_pinned_azure_cli_then_browser_for_local_development(self):
        with patch.dict(os.environ, self.base_env, clear=True):
            with patch.dict(sys.modules, {"azure.identity": fake_identity_module()}):
                auth = load_auth_module()
                credential = auth.get_credential()

        self.assertIsInstance(credential, FakeChainedTokenCredential)
        self.assertEqual(len(credential.credentials), 2)
        azure_cli, browser = credential.credentials
        self.assertIsInstance(azure_cli, FakeAzureCliCredential)
        self.assertEqual(
            azure_cli.kwargs,
            {"tenant_id": "tenant-id", "process_timeout": 30},
        )
        self.assertIsInstance(browser, FakeInteractiveBrowserCredential)
        self.assertEqual(browser.kwargs, {"tenant_id": "tenant-id"})

    def test_rejects_partially_configured_service_principal(self):
        with patch.dict(
            os.environ,
            {**self.base_env, "CLIENT_ID": "client-id"},
            clear=True,
        ):
            with patch.dict(sys.modules, {"azure.identity": fake_identity_module()}):
                auth = load_auth_module()

                with self.assertRaisesRegex(
                    ValueError,
                    "CLIENT_ID and CLIENT_SECRET must be configured together",
                ):
                    auth.get_credential()

    def test_main_reports_success_without_printing_the_token(self):
        with patch.dict(os.environ, self.base_env, clear=True):
            with patch.dict(sys.modules, {"azure.identity": fake_identity_module()}):
                auth = load_auth_module()
                output = io.StringIO()

                with redirect_stdout(output):
                    auth.main()

        rendered = output.getvalue()
        self.assertIn("Dataverse token acquired", rendered)
        self.assertNotIn("sensitive-token", rendered)


if __name__ == "__main__":
    unittest.main()
