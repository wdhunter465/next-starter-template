import unittest

from skeetersoft.series import segment_series, sort_print_order


def _g(game_id, date, home, visitor, game_number=1, game_type="Regular Season"):
    return {
        "game_id": game_id,
        "date": date,
        "season": 1985,
        "home": home,
        "visitor": visitor,
        "game_number": game_number,
        "game_type": game_type,
    }


class SeriesTests(unittest.TestCase):
    def test_doubleheader_same_series(self):
        games = segment_series(
            [
                _g("DH1", "1985-06-01", "BOS", "NYA", 1),
                _g("DH2", "1985-06-01", "BOS", "NYA", 2),
            ]
        )
        self.assertEqual(games[0]["series_id"], games[1]["series_id"])
        self.assertEqual(games[0]["series_game_count"], 2)

    def test_offday_continuation(self):
        games = segment_series(
            [
                _g("A", "1985-06-10", "CHW", "DET"),
                _g("B", "1985-06-12", "CHW", "DET"),
            ]
        )
        self.assertEqual(games[0]["series_id"], games[1]["series_id"])

    def test_intervening_opponent_splits(self):
        games = segment_series(
            [
                _g("S1", "1985-07-01", "KCA", "TOR"),
                _g("MID", "1985-07-02", "BOS", "TOR"),
                _g("S2", "1985-07-03", "KCA", "TOR"),
            ]
        )
        by_id = {g["game_id"]: g["series_id"] for g in games}
        self.assertNotEqual(by_id["S1"], by_id["S2"])
        self.assertNotEqual(by_id["S1"], by_id["MID"])

    def test_venue_reversal_splits(self):
        games = segment_series(
            [
                _g("R1", "1985-08-01", "KCA", "TOR"),
                _g("R2", "1985-08-02", "TOR", "KCA"),
            ]
        )
        self.assertNotEqual(games[0]["series_id"], games[1]["series_id"])

    def test_print_order_home_abbrev_tiebreak(self):
        games = segment_series(
            [
                _g("B", "1985-04-01", "KCA", "TOR"),
                _g("A", "1985-04-01", "BOS", "NYA"),
            ]
        )
        ordered = sort_print_order(games)
        self.assertEqual(ordered[0]["home"], "BOS")
        self.assertEqual(ordered[1]["home"], "KCA")


if __name__ == "__main__":
    unittest.main()
