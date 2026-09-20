import tempfile
import unittest
from pathlib import Path

from skeetersoft.compile import compile_records
from skeetersoft.ingest import event_games_to_records, parse_event_file
from skeetersoft.pdf import render_ledger_pdf
from skeetersoft.teams import merge_aliases


FIXTURE = Path(__file__).resolve().parent / "fixtures" / "sample.EVN"


class PdfTests(unittest.TestCase):
    def test_letter_pdf_has_one_page_per_game(self):
        games, register = parse_event_file(FIXTURE)
        records = event_games_to_records(games)
        compiled = compile_records(records, aliases=merge_aliases(), register=register)
        with tempfile.TemporaryDirectory() as tmp:
            path = render_ledger_pdf(compiled["accepted"], Path(tmp) / "ledger.pdf")
            data = path.read_bytes()
            size = path.stat().st_size
        self.assertTrue(data.startswith(b"%PDF-1.4"))
        self.assertIn(b"%%EOF", data)
        self.assertIn(b"/Count 2", data)
        self.assertIn(b"C. Davis", data)
        self.assertIn(b"M. Davis", data)
        self.assertGreater(size, 1000)


if __name__ == "__main__":
    unittest.main()
