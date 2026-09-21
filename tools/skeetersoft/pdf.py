"""Letter PDF print output for the Skeetersoft Replay Ledger.

This is the Product print deliverable. The utility still runs from a local git
checkout of the sandbox branch. Google Drive is not a runtime.

Each page is a blank scorecard for one game: two lineup tables (visitor
upper, home lower) with a scoring diamond drawn in every inning box, a
linescore strip between them, and a pitching log at the bottom. Innings are
scored by hand after the game is replayed — this module only prints the
grid, the pre-game lineups, and the starting pitchers.
"""

from __future__ import annotations

from pathlib import Path

LETTER = (612.0, 792.0)
LEFT = 61.2  # 0.85 in binding gutter
RIGHT = 36.0  # 0.5 in
TOP = 766.8  # 11 in - 0.35 in
BOTTOM = 28.8  # 0.4 in
TABLE_W = LETTER[0] - LEFT - RIGHT

INNINGS = 9
ORDER_W = 16.0
NAME_W = 118.0
POS_W = 20.0
INNING_W = (TABLE_W - ORDER_W - NAME_W - POS_W) / INNINGS

BODY_ROWS = 11  # 9 starters + 2 blank substitute lines
TABLE_HEADER_H = 16.0

LS_LABEL_W = 150.0
LS_RH_W = 25.0
LS_INNING_W = (TABLE_W - LS_LABEL_W - 2 * LS_RH_W) / INNINGS
LS_HEADER_H = 14.0
LS_ROW_H = 16.0
LINESCORE_H = LS_HEADER_H + 2 * LS_ROW_H

PITCH_ROWS = 4  # starter line + 3 blank relief lines
PITCH_ROW_H = 14.0
PITCH_HEADER_H = 24.0  # team label line + stat-abbreviation line
PITCH_TAIL_H = 14.0  # gap + decision line
PITCHING_H = PITCH_HEADER_H + PITCH_ROWS * PITCH_ROW_H + PITCH_TAIL_H

HEADER_BLOCK_H = 30.0
SECTION_GAP = 8.0

# Row height is solved so the two lineup tables, the linescore strip, the
# pitching log, and the top header fill the page exactly (TOP down to
# BOTTOM) instead of leaving the bottom of the sheet blank.
FIXED_H = (
    HEADER_BLOCK_H
    + 2 * TABLE_HEADER_H
    + LINESCORE_H
    + PITCHING_H
    + 3 * SECTION_GAP
)
ROW_H = (TOP - BOTTOM - FIXED_H) / (2 * BODY_ROWS)

POS_NUMBERS = {
    "P": "1",
    "C": "2",
    "1B": "3",
    "2B": "4",
    "3B": "5",
    "SS": "6",
    "LF": "7",
    "CF": "8",
    "RF": "9",
    "DH": "DH",
}


def _pdf_escape(text: str) -> str:
    cleaned = (text or "").encode("latin-1", "replace").decode("latin-1")
    return cleaned.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _text(x: float, y: float, text: str, size: float = 10, font: str = "F1") -> str:
    return f"BT /{font} {size:.1f} Tf {x:.2f} {y:.2f} Td ({_pdf_escape(text)}) Tj ET"


def _rect(x: float, y: float, w: float, h: float) -> str:
    return f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re S"


def _diamond(cx: float, cy: float, rx: float, ry: float) -> str:
    return (
        f"{cx - rx:.2f} {cy:.2f} m "
        f"{cx:.2f} {cy + ry:.2f} l "
        f"{cx + rx:.2f} {cy:.2f} l "
        f"{cx:.2f} {cy - ry:.2f} l h S"
    )


def _lineup_table(role: str, team: str, lineup: list[dict], y: float) -> tuple[str, float]:
    cmds = []
    header_bottom = y - TABLE_HEADER_H
    headers = ["#", f"{role} {team}", "Pos"] + [str(n) for n in range(1, INNINGS + 1)]
    widths = [ORDER_W, NAME_W, POS_W] + [INNING_W] * INNINGS
    x = LEFT
    for label, width in zip(headers, widths):
        cmds.append(_rect(x, header_bottom, width, TABLE_HEADER_H))
        cmds.append(_text(x + 2, header_bottom + 4, label, size=7, font="F2"))
        x += width
    y = header_bottom

    for i in range(BODY_ROWS):
        player = lineup[i] if i < len(lineup) else None
        name = (player or {}).get("display_name", "")
        raw_pos = (player or {}).get("field", "")
        pos = POS_NUMBERS.get(raw_pos, raw_pos)
        row_bottom = y - ROW_H
        x = LEFT

        cmds.append(_rect(x, row_bottom, ORDER_W, ROW_H))
        cmds.append(_text(x + 3, row_bottom + ROW_H / 2 - 3, str(i + 1), size=8))
        x += ORDER_W

        cmds.append(_rect(x, row_bottom, NAME_W, ROW_H))
        if name:
            cmds.append(_text(x + 3, row_bottom + ROW_H / 2 - 3, name[:20], size=8))
        x += NAME_W

        cmds.append(_rect(x, row_bottom, POS_W, ROW_H))
        if pos:
            cmds.append(_text(x + 3, row_bottom + ROW_H / 2 - 3, str(pos), size=8))
        x += POS_W

        for _ in range(INNINGS):
            cmds.append(_rect(x, row_bottom, INNING_W, ROW_H))
            cmds.append(
                _diamond(x + INNING_W / 2, row_bottom + ROW_H / 2, INNING_W * 0.32, ROW_H * 0.34)
            )
            x += INNING_W

        y = row_bottom

    return "\n".join(cmds), y


def _linescore_block(visitor: str, home: str, y: float) -> tuple[str, float]:
    cmds = []
    header_bottom = y - LS_HEADER_H
    headers = ["Team / Record"] + [str(n) for n in range(1, INNINGS + 1)] + ["R", "H"]
    widths = [LS_LABEL_W] + [LS_INNING_W] * INNINGS + [LS_RH_W, LS_RH_W]
    x = LEFT
    for label, width in zip(headers, widths):
        cmds.append(_rect(x, header_bottom, width, LS_HEADER_H))
        cmds.append(_text(x + 2, header_bottom + 3, label, size=6, font="F2"))
        x += width
    y = header_bottom

    for role, code in (("V", visitor), ("H", home)):
        row_bottom = y - LS_ROW_H
        x = LEFT
        cmds.append(_rect(x, row_bottom, LS_LABEL_W, LS_ROW_H))
        cmds.append(_text(x + 3, row_bottom + 4, f"{role}  {code}", size=8, font="F2"))
        x += LS_LABEL_W
        for _ in range(INNINGS):
            cmds.append(_rect(x, row_bottom, LS_INNING_W, LS_ROW_H))
            x += LS_INNING_W
        cmds.append(_rect(x, row_bottom, LS_RH_W, LS_ROW_H))
        x += LS_RH_W
        cmds.append(_rect(x, row_bottom, LS_RH_W, LS_ROW_H))
        y = row_bottom

    return "\n".join(cmds), y


def _pitching_column(x0: float, team: str, starter: str, y: float, col_w: float) -> str:
    cmds = [_text(x0, y - 9, f"{team} Pitching", size=8, font="F2")]
    stat_w = 24.0
    name_w = col_w - stat_w * 6
    stats = ["IP", "H", "BB", "K", "R", "ER"]

    x = x0 + name_w
    for label in stats:
        cmds.append(_text(x + 2, y - 21, label, size=6))
        x += stat_w

    row_top = y - PITCH_HEADER_H
    for i, name in enumerate([starter, "", "", ""]):
        row_bottom = row_top - PITCH_ROW_H * (i + 1)
        x = x0
        cmds.append(_rect(x, row_bottom, name_w, PITCH_ROW_H))
        if name:
            cmds.append(_text(x + 2, row_bottom + 4, name[:18], size=7))
        x += name_w
        for _ in stats:
            cmds.append(_rect(x, row_bottom, stat_w, PITCH_ROW_H))
            x += stat_w

    tail_top = row_top - PITCH_ROWS * PITCH_ROW_H
    cmds.append(_text(x0, tail_top - 10, "Decision:      W      L      S", size=7))
    return "\n".join(cmds)


def render_game_stream(game: dict) -> str:
    page_w = LETTER[0]
    visitor = game["visitor"]
    home = game["home"]
    cmds = ["0.2 w"]

    y = TOP
    cmds.append(_text(LEFT, y, str(game.get("date") or ""), size=9, font="F2"))
    cmds.append(_text(LEFT, y - 12, f"{visitor} at {home}", size=9))
    right_label = (
        f"Season G{game.get('game_number') or 1} · {game.get('game_type') or ''} · "
        f"{game.get('day_night') or ''}"
    )
    cmds.append(_text(page_w - RIGHT - 230, y, right_label, size=8))
    series_label = (
        f"Series {game.get('series_game_index')} of {game.get('series_game_count')} "
        f"(id {game.get('series_id')})"
    )
    cmds.append(_text(page_w - RIGHT - 230, y - 12, series_label, size=8))
    y -= HEADER_BLOCK_H

    block, y = _lineup_table("V", visitor, game.get("visitor_lineup") or [], y)
    cmds.append(block)
    y -= SECTION_GAP

    block, y = _linescore_block(visitor, home, y)
    cmds.append(block)
    y -= SECTION_GAP

    block, y = _lineup_table("H", home, game.get("home_lineup") or [], y)
    cmds.append(block)
    y -= SECTION_GAP

    visitor_pitch = (game.get("visitor_pitcher") or {}).get("display_name") or ""
    home_pitch = (game.get("home_pitcher") or {}).get("display_name") or ""
    col_gap = 12.0
    col_w = (page_w - LEFT - RIGHT - col_gap) / 2
    cmds.append(_pitching_column(LEFT, visitor, visitor_pitch, y, col_w))
    cmds.append(_pitching_column(LEFT + col_w + col_gap, home, home_pitch, y, col_w))
    return "\n".join(cmds)


def render_ledger_pdf(games: list[dict], path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    contents = [render_game_stream(game).encode("latin-1") for game in games]
    n_pages = len(contents)
    catalog_id, pages_id, font1_id, font2_id = 1, 2, 3, 4
    next_id = 5
    kids: list[str] = []
    page_objs: list[tuple[int, str]] = []
    content_objs: list[tuple[int, bytes]] = []
    for stream in contents:
        page_id = next_id
        content_id = next_id + 1
        next_id += 2
        kids.append(f"{page_id} 0 R")
        content_objs.append((content_id, stream))
        page_objs.append(
            (
                page_id,
                "<< /Type /Page /Parent 2 0 R "
                "/MediaBox [0 0 612 792] "
                f"/Contents {content_id} 0 R "
                f"/Resources << /Font << /F1 {font1_id} 0 R /F2 {font2_id} 0 R >> >> >>",
            )
        )

    numbered: list[tuple[int, bytes]] = [
        (catalog_id, f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode("latin-1")),
        (
            pages_id,
            f"<< /Type /Pages /Count {n_pages} /Kids [{' '.join(kids)}] >>".encode("latin-1"),
        ),
        (font1_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>"),
        (font2_id, b"<< /Type /Font /Subtype /Type1 /BaseFont /Times-Bold >>"),
    ]
    for page_id, body in page_objs:
        numbered.append((page_id, body.encode("latin-1")))
    for content_id, stream in content_objs:
        numbered.append(
            (
                content_id,
                f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1") + stream + b"\nendstream",
            )
        )
    numbered.sort(key=lambda item: item[0])

    out = bytearray(b"%PDF-1.4\n")
    offsets = {0: 0}
    for num, body in numbered:
        offsets[num] = len(out)
        out.extend(f"{num} 0 obj\n".encode("latin-1"))
        out.extend(body)
        out.extend(b"\nendobj\n")
    xref_pos = len(out)
    size = next_id
    out.extend(f"xref\n0 {size}\n".encode("latin-1"))
    out.extend(b"0000000000 65535 f \n")
    for num in range(1, size):
        out.extend(f"{offsets[num]:010d} 00000 n \n".encode("latin-1"))
    out.extend(
        f"trailer\n<< /Size {size} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode("latin-1")
    )
    path.write_bytes(bytes(out))
    return path
