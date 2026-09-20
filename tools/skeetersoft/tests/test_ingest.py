import unittest
from pathlib import Path

from skeetersoft.compile import compile_records
from skeetersoft.ingest import parse_event_file, event_games_to_records, split_retrosheet_name
from skeetersoft.teams import merge_aliases
from skeetersoft.validate import validate_print_stream


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample.EVN"


class IngestTests(unittest.TestCase):
    def test_name_split(self):
        self.assertEqual(
            split_retrosheet_name("Van Slyke, Andy Jr"),
            {"given": "Andy", "surname": "Van Slyke", "suffix": "Jr"},
        )
        self.assertEqual(
            split_retrosheet_name("Cecil Cooper"),
            {"given": "Cecil", "surname": "Cooper", "suffix": ""},
        )

    def test_sample_event_file_compiles(self):
        games, register = parse_event_file(FIXTURE)
        self.assertEqual(len(games), 3)
        records = event_games_to_records(games)
        self.assertEqual(len(records), 2)
        result = compile_records(records, aliases=merge_aliases(), register=register)
        self.assertEqual(result["exceptions"], [])
        self.assertEqual(len(result["accepted"]), 2)
        self.assertEqual(validate_print_stream(result["accepted"]), [])
        collide = next(game for game in result["accepted"] if game["game_id"] == "SFN198506150")
        names = {row["player_id"]: row["display_name"] for row in collide["home_lineup"]}
        self.assertEqual(names["davic001"], "C. Davis")
        self.assertEqual(names["davim001"], "M. Davis")
        self.assertEqual(collide["visitor"], "SDN")
        self.assertEqual(collide["home"], "SFN")


if __name__ == "__main__":
    unittest.main()
