import unittest

from scripts.seed_apex_data import (
    CONFIG_SET_BASELINE,
    CONFIG_SET_NAME,
    CONFIG_SET_VERSION,
    HEALTH_BANDS,
    ROUNDS,
    TEAMS,
    WEIGHTS,
    build_allocations,
    build_categories,
    build_config_set,
    build_expected_counts,
    build_health_bands,
    build_rounds,
    build_weights,
    round_event_category_pairs,
)

CONFIG_SET_ID = "11111111-1111-4111-8111-111111111111"
SIMULATION_ID = "22222222-2222-4222-8222-222222222222"
WEIGHTS_ID = "33333333-3333-4333-8333-333333333333"
ROUND_IDS = {1: "round-1-guid", 2: "round-2-guid", 3: "round-3-guid"}
TEAM_IDS = {name: f"team-{index}-guid" for index, name in enumerate(TEAMS, start=1)}


def fake_category_map():
    category_map = {}
    for round_data in ROUNDS:
        round_id = ROUND_IDS[round_data["index"]]
        for category_key, name, _description in round_data["categories"]:
            category_map[(round_id, category_key)] = {
                "id": f"cat-{round_data['index']}-{category_key}",
                "key": category_key,
                "name": name,
            }
    return category_map


class ConfigSetSeedTests(unittest.TestCase):
    def test_seeds_one_published_baseline_config_set(self):
        desired = build_config_set()

        self.assertEqual(len(desired), 1)
        key, payload = desired[0]
        self.assertEqual(key, CONFIG_SET_VERSION)
        self.assertEqual(payload["mw_configset_name"], CONFIG_SET_NAME)
        self.assertEqual(payload["mw_version"], CONFIG_SET_VERSION)
        self.assertEqual(payload["mw_status"], "Published")
        self.assertEqual(payload["mw_systemhealthbaseline"], CONFIG_SET_BASELINE)
        self.assertTrue(payload["mw_publishedat"])

    def test_weights_cover_every_round_event_category_pair_exactly_once(self):
        desired = build_weights(CONFIG_SET_ID)
        pairs = [(payload["mw_eventkey"], payload["mw_categorykey"]) for _, payload in desired]

        self.assertEqual(len(desired), 15)
        self.assertEqual(len(set(pairs)), 15)
        self.assertEqual(set(pairs), set(round_event_category_pairs()))
        for key, payload in desired:
            event_key = payload["mw_eventkey"]
            category_key = payload["mw_categorykey"]
            self.assertEqual(key, (CONFIG_SET_ID, event_key, category_key))
            self.assertEqual(payload["mw_weight_name"], f"{event_key}:{category_key}")
            self.assertEqual(payload["mw_value"], WEIGHTS[event_key][category_key])
            self.assertIn(CONFIG_SET_ID, payload["mw_ConfigSetId@odata.bind"])

    def test_health_bands_are_exactly_red_yellow_green_in_order(self):
        desired = build_health_bands(CONFIG_SET_ID)

        self.assertEqual(
            [payload["mw_label"] for _, payload in desired],
            ["Red", "Yellow", "Green"],
        )
        self.assertEqual(
            [payload["mw_minscore"] for _, payload in desired], [0, 40, 70]
        )
        self.assertEqual(
            [payload["mw_displayorder"] for _, payload in desired], [1, 2, 3]
        )
        for key, payload in desired:
            self.assertEqual(key, (CONFIG_SET_ID, payload["mw_label"]))
            self.assertEqual(payload["mw_color"], payload["mw_label"])
            self.assertEqual(payload["mw_healthband_name"], payload["mw_label"])
            self.assertIn(CONFIG_SET_ID, payload["mw_ConfigSetId@odata.bind"])
        self.assertEqual(len(HEALTH_BANDS), 3)


class RoundAndCategorySeedTests(unittest.TestCase):
    def test_every_round_is_assigned_the_config_set(self):
        desired = build_rounds(SIMULATION_ID, WEIGHTS_ID, CONFIG_SET_ID)

        self.assertEqual(len(desired), 3)
        for (simulation_id, _index), payload in desired:
            self.assertEqual(simulation_id, SIMULATION_ID)
            self.assertIn(CONFIG_SET_ID, payload["mw_ConfigSetId@odata.bind"])
            self.assertIn(WEIGHTS_ID, payload["mw_WeightsConfigId@odata.bind"])
        self.assertEqual(
            [payload["mw_status"] for _, payload in desired],
            ["Revealed", "Revealed", "Open"],
        )

    def test_categories_have_stable_keys_and_ordered_display_orders(self):
        desired = build_categories(ROUND_IDS)

        self.assertEqual(len(desired), 15)
        for round_data in ROUNDS:
            round_id = ROUND_IDS[round_data["index"]]
            round_rows = [
                (key, payload)
                for key, payload in desired
                if key[0] == round_id
            ]
            self.assertEqual(
                [payload["mw_displayorder"] for _, payload in round_rows],
                [1, 2, 3, 4, 5],
            )
            self.assertEqual(
                [key[1] for key, _ in round_rows],
                [category[0] for category in round_data["categories"]],
            )


class AllocationSeedTests(unittest.TestCase):
    def test_no_authoritative_submissions_are_seeded(self):
        expected = build_expected_counts(member_count=6)

        self.assertNotIn("mw_teamsubmission", expected)

    def test_current_open_round_allocations_stay_draft(self):
        desired = build_allocations(ROUND_IDS, TEAM_IDS, fake_category_map())

        open_round_rows = [
            payload for key, payload in desired if key[0] == ROUND_IDS[3]
        ]
        historical_rows = [
            payload for key, payload in desired if key[0] != ROUND_IDS[3]
        ]
        self.assertEqual(len(desired), 45)
        self.assertEqual(len(open_round_rows), 15)
        for payload in open_round_rows:
            self.assertNotIn("mw_submittedat", payload)
        for payload in historical_rows:
            self.assertIn("mw_submittedat", payload)


class ExpectedCountTests(unittest.TestCase):
    def test_expected_counts_cover_the_new_configuration_tables(self):
        expected = build_expected_counts(member_count=6)

        self.assertEqual(expected["mw_configset"], 1)
        self.assertEqual(expected["mw_weight"], 15)
        self.assertEqual(expected["mw_healthband"], 3)
        self.assertEqual(expected["mw_category"], 15)
        self.assertEqual(expected["mw_allocation"], 45)
        self.assertEqual(expected["mw_teammember"], 6)

    def test_builders_are_deterministic_for_rerun_identity(self):
        category_map = fake_category_map()

        self.assertEqual(build_config_set(), build_config_set())
        self.assertEqual(build_weights(CONFIG_SET_ID), build_weights(CONFIG_SET_ID))
        self.assertEqual(
            build_health_bands(CONFIG_SET_ID), build_health_bands(CONFIG_SET_ID)
        )
        self.assertEqual(
            build_rounds(SIMULATION_ID, WEIGHTS_ID, CONFIG_SET_ID),
            build_rounds(SIMULATION_ID, WEIGHTS_ID, CONFIG_SET_ID),
        )
        self.assertEqual(build_categories(ROUND_IDS), build_categories(ROUND_IDS))
        self.assertEqual(
            build_allocations(ROUND_IDS, TEAM_IDS, category_map),
            build_allocations(ROUND_IDS, TEAM_IDS, category_map),
        )


if __name__ == "__main__":
    unittest.main()
