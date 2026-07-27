"""Pure desired-schema declarations for Apex Simulation metadata."""

SOLUTION = "ApexSimulation"

EXPECTED_TABLES = (
    "mw_simulation",
    "mw_round",
    "mw_category",
    "mw_team",
    "mw_teammember",
    "mw_allocation",
    "mw_teamroundresult",
    "mw_weightsconfig",
    "mw_configset",
    "mw_weight",
    "mw_healthband",
    "mw_teamsubmission",
)

MANAGED_TABLES = (
    (
        "mw_ConfigSet",
        {
            "mw_Version": "string",
            "mw_Status": "string",
            "mw_SystemHealthBaseline": "decimal",
        },
        "Config Set",
        "mw_ConfigSet_Name",
    ),
    (
        "mw_Weight",
        {
            "mw_EventKey": "string",
            "mw_CategoryKey": "string",
            "mw_Value": "decimal",
        },
        "Weight",
        "mw_Weight_Name",
    ),
    (
        "mw_HealthBand",
        {
            "mw_Label": "string",
            "mw_MinScore": "decimal",
            "mw_Color": "string",
            "mw_DisplayOrder": "int",
        },
        "Health Band",
        "mw_HealthBand_Name",
    ),
    (
        "mw_TeamSubmission",
        {
            "mw_AllocationPayload": "string",
            "mw_SubmittedByRef": "string",
        },
        "Team Submission",
        "mw_TeamSubmission_Name",
    ),
)

DATETIME_COLUMNS = (
    (
        "mw_configset",
        "mw_PublishedAt",
        "Published At",
        "UserLocal",
        "DateAndTime",
    ),
    (
        "mw_teamsubmission",
        "mw_SubmittedAt",
        "Submitted At",
        "UserLocal",
        "DateAndTime",
    ),
)

EXTRA_SCALAR_COLUMNS = (
    ("mw_round", "mw_EventKey", "string"),
    ("mw_category", "mw_Key", "string"),
    ("mw_category", "mw_DisplayOrder", "int"),
)

MANAGED_LOOKUPS = (
    ("mw_weight", "mw_ConfigSetId", "mw_configset", "Config Set"),
    ("mw_healthband", "mw_ConfigSetId", "mw_configset", "Config Set"),
    ("mw_round", "mw_ConfigSetId", "mw_configset", "Config Set"),
    ("mw_teamsubmission", "mw_RoundId", "mw_round", "Round"),
    ("mw_teamsubmission", "mw_TeamId", "mw_team", "Team"),
)

MANAGED_KEYS = (
    (
        "mw_teamroundresult",
        "mw_TeamRoundResult_RoundTeam_Key",
        ["mw_roundid", "mw_teamid"],
        "Round and Team",
    ),
    (
        "mw_configset",
        "mw_ConfigSet_Version_Key",
        ["mw_version"],
        "Configuration Version",
    ),
    (
        "mw_weight",
        "mw_Weight_ConfigEventCategory_Key",
        ["mw_configsetid", "mw_eventkey", "mw_categorykey"],
        "Config Event Category",
    ),
    (
        "mw_healthband",
        "mw_HealthBand_ConfigLabel_Key",
        ["mw_configsetid", "mw_label"],
        "Config Label",
    ),
    (
        "mw_teamsubmission",
        "mw_TeamSubmission_Round_Team_Key",
        ["mw_roundid", "mw_teamid"],
        "Round and Team",
    ),
)

LONG_TEXT_COLUMNS = (
    ("mw_round", "mw_eventdescription"),
    ("mw_teamroundresult", "mw_contributionsjson"),
    ("mw_teamroundresult", "mw_rationale"),
    ("mw_weightsconfig", "mw_payload"),
    ("mw_teamsubmission", "mw_allocationpayload"),
)

LONG_TEXT_MAX_LENGTH = 4000
