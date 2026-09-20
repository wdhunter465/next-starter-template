import unittest

from skeetersoft.compile import compile_records
from skeetersoft.parse import ParseError, parse_iso_date, validate_game
from skeetersoft.pilot_data import ACCEPTED_GAMES, FAILURE_GAMES, TEAM_ALIASES
from skeetersoft.render import render_ledger
from skeetersoft.validate import validate_print_stream


class ParseTests(unittest.TestCase):
    def test_rejects_invalid_date(self):
        with self.assertRaises(ParseError) as ctx:
            parse_iso_date("1985-13-40")
        self.assertEqual(ctx.exception.code, "invalid_date")

    def test_rejects_season_bounds(self):
        raw = dict(ACCEPTED_GAMES[0])
        raw["game_id"] = "OUT"
        raw["season"] = 1990
        with self.assertRaises(ParseError) as ctx:
            validate_game(raw, TEAM_ALIASES, set())
        self.assertEqual(ctx.exception.code, "season_out_of_bounds")


class CompilePilotTests(unittest.TestCase):
    def test_accepted_fixtures_compile(self):
        result = compile_records(ACCEPTED_GAMES)
        self.assertEqual(result["exceptions"], [])
        self.assertGreaterEqual(len(result["accepted"]), 13)
        errors = validate_print_stream(result["accepted"])
        self.assertEqual(errors, [])
        davis = next(g for g in result["accepted"] if g["fixture_id"] == "F-COLLIDE-DAVIS")
        home_names = {p["player_id"]: p["display_name"] for p in davis["home_lineup"]}
        self.assertEqual(home_names["SYN-SFN-C"], "C. Davis")
        self.assertEqual(home_names["SYN-SFN-M"], "M. Davis")
        compound = next(g for g in result["accepted"] if g["fixture_id"] == "F-NAME-COMPOUND")
        visitor_names = {p["player_id"]: p["display_name"] for p in compound["visitor_lineup"]}
        self.assertEqual(visitor_names["SYN-PIT-VAN"], "Van Slyke Jr")

    def test_failure_paths_do_not_publish_complete_records(self):
        result = compile_records(FAILURE_GAMES)
        codes = {item["code"] for item in result["exceptions"]}
        self.assertIn("missing_lineup", codes)
        self.assertIn("invalid_date", codes)
        self.assertIn("duplicate_game_id", codes)
        self.assertIn("duplicate_player_id", codes)
        self.assertIn("unknown_team_alias", codes)
        accepted_ids = {g["fixture_id"] for g in result["accepted"]}
        self.assertTrue(accepted_ids <= {"F-DUP-GAME"})

    def test_html_visitor_above_home_and_page_count(self):
        result = compile_records(ACCEPTED_GAMES)
        html = render_ledger(result["accepted"])
        self.assertEqual(html.count('class="game-page"'), len(result["accepted"]))
        layout = next(g for g in result["accepted"] if g["fixture_id"] == "F-LAYOUT-1985-OPEN")
        chunk = html.split(f'id="{layout["game_id"]}"', 1)[1]
        self.assertLess(chunk.find("data-side=\"TOR\""), chunk.find("data-side=\"KCA\""))
        self.assertIn("@page { size: letter portrait; margin: 0; }", html)
        self.assertIn("0.85in", html)


if __name__ == "__main__":
    unittest.main()
