import unittest

from skeetersoft.names import display_names_for_side


class NameCollisionTests(unittest.TestCase):
    def test_unique_surname_displays_surname_only(self):
        players = [
            {"player_id": "A", "given": "Andy", "surname": "Van Slyke", "suffix": "Jr"},
            {"player_id": "B", "given": "Bill", "surname": "Madlock", "suffix": ""},
        ]
        displays = display_names_for_side(players)
        self.assertEqual(displays["A"], "Van Slyke Jr")
        self.assertEqual(displays["B"], "Madlock")

    def test_distinct_initials(self):
        players = [
            {"player_id": "C", "given": "Chili", "surname": "Davis", "suffix": ""},
            {"player_id": "M", "given": "Mark", "surname": "Davis", "suffix": ""},
        ]
        displays = display_names_for_side(players)
        self.assertEqual(displays["C"], "C. Davis")
        self.assertEqual(displays["M"], "M. Davis")

    def test_same_initial_escalates(self):
        players = [
            {"player_id": "1", "given": "Carl", "surname": "Davis", "suffix": ""},
            {"player_id": "2", "given": "Craig", "surname": "Davis", "suffix": ""},
            {"player_id": "3", "given": "Mark", "surname": "Davis", "suffix": ""},
        ]
        displays = display_names_for_side(players)
        self.assertEqual(displays["1"], "Ca. Davis")
        self.assertEqual(displays["2"], "Cr. Davis")
        self.assertEqual(displays["3"], "Ma. Davis")

    def test_duplicate_player_id_is_error(self):
        players = [
            {"player_id": "X", "given": "A", "surname": "Same", "suffix": ""},
            {"player_id": "X", "given": "B", "surname": "Same", "suffix": ""},
        ]
        with self.assertRaises(ValueError):
            display_names_for_side(players)


if __name__ == "__main__":
    unittest.main()
