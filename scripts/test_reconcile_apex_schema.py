import unittest

from scripts.apex_schema import (
    DATETIME_COLUMNS,
    EXPECTED_TABLES,
    EXTRA_SCALAR_COLUMNS,
    LONG_TEXT_COLUMNS,
    LONG_TEXT_MAX_LENGTH,
    MANAGED_KEYS,
    MANAGED_LOOKUPS,
    MANAGED_TABLES,
)


class ApexSchemaDeclarationsTests(unittest.TestCase):
    def test_declares_authoritative_team_submission_table(self):
        submission = next(
            table for table in MANAGED_TABLES if table[0] == "mw_TeamSubmission"
        )

        self.assertEqual(submission[2], "Team Submission")
        self.assertEqual(submission[3], "mw_TeamSubmission_Name")
        self.assertEqual(
            submission[1],
            {
                "mw_AllocationPayload": "string",
                "mw_SubmittedByRef": "string",
            },
        )
        self.assertIn("mw_teamsubmission", EXPECTED_TABLES)

    def test_declares_submission_relationships_and_round_team_key(self):
        self.assertIn(
            ("mw_teamsubmission", "mw_RoundId", "mw_round", "Round"),
            MANAGED_LOOKUPS,
        )
        self.assertIn(
            ("mw_teamsubmission", "mw_TeamId", "mw_team", "Team"),
            MANAGED_LOOKUPS,
        )
        self.assertIn(
            (
                "mw_teamsubmission",
                "mw_TeamSubmission_Round_Team_Key",
                ["mw_roundid", "mw_teamid"],
                "Round and Team",
            ),
            MANAGED_KEYS,
        )

    def test_declares_category_order_and_submission_payload_length(self):
        self.assertIn(
            ("mw_category", "mw_DisplayOrder", "int"),
            EXTRA_SCALAR_COLUMNS,
        )
        self.assertIn(
            ("mw_teamsubmission", "mw_allocationpayload"),
            LONG_TEXT_COLUMNS,
        )
        self.assertEqual(LONG_TEXT_MAX_LENGTH, 4000)

    def test_declares_timestamps_with_explicit_behavior_and_format(self):
        self.assertIn(
            (
                "mw_configset",
                "mw_PublishedAt",
                "Published At",
                "UserLocal",
                "DateAndTime",
            ),
            DATETIME_COLUMNS,
        )
        self.assertIn(
            (
                "mw_teamsubmission",
                "mw_SubmittedAt",
                "Submitted At",
                "UserLocal",
                "DateAndTime",
            ),
            DATETIME_COLUMNS,
        )
        config_set = next(
            table for table in MANAGED_TABLES if table[0] == "mw_ConfigSet"
        )
        self.assertNotIn("mw_PublishedAt", config_set[1])


if __name__ == "__main__":
    unittest.main()
