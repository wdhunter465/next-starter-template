"""Letter PDF print output for the Skeetersoft Replay Ledger.

This is the Product print deliverable. The utility still runs from a local git
checkout of the sandbox branch. Google Drive is not a runtime.
"""

from __future__ import annotations

from pathlib import Path

LETTER = (612.0, 792.0)
LEFT = 61.2  # 0.85 in
RIGHT = 36.0
TOP = 766.8  # 11 in - 0.35 in
ROW_H = 12.0
COL_NAME = 122.0
COL_POS = 28.0
COL_STAT = 22.0


def _pdf_escape(text: str) -> str:
    cleaned = (text or "").encode("latin-1", "replace").decode("latin-1")
    return cleaned.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _text(x: float, y: float, text: str, size: float = 10, font: str = "F1") -> str:
    return f"BT /{font} {size:.1f} Tf {x:.2f} {y:.2f} Td ({_pdf_escape(text)}) Tj ET"


def _rect(x: float, y: float, w: float, h: float) -> str:
    return f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re S"


def _line(x1: float, y1: float, x2: float, y2: float) -> str:
    return f"{x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S"


def _lineup_block(title: str, lineup: list[dict], y: float, page_w: float) -> tuple[str, float]:
    table_w = page_w - LEFT - RIGHT
    innings = 9
    cmds = [_text(LEFT, y, title, size=12, font="F2")]
    y -= 16
    headers = ["Player", "Pos"] + [str(n) for n in range(1, 10)] + ["AB", "R", "H", "RBI"]
    widths = [COL_NAME, COL_POS] + [COL_STAT] * innings + [COL_STAT] * 4
    x = LEFT
    header_y = y
    for label, width in zip(headers, widths):
        cmds.append(_rect(x, header_y - ROW_H, width, ROW_H))
        cmds.append(_text(x + 2, header_y - 10, label, size=8))
        x += width
    y = header_y - ROW_H
    for player in lineup:
        x = LEFT
        values = [player.get("display_name") or "", str(player.get("field") or "")] + [""] * 13
        for value, width in zip(values, widths):
            cmds.append(_rect(x, y - ROW_H, width, ROW_H))
            if value:
                cmds.append(_text(x + 2, y - 10, str(value)[:22], size=8))
            x += width
        y -= ROW_H
    return "\n".join(cmds), y - 8


def render_game_stream(game: dict) -> str:
    page_w, page_h = LETTER
    visitor = game["visitor"]
    home = game["home"]
    y = TOP
    cmds = [
        "0.2 w",
        _text(page_w - 180, TOP, str(game.get("date") or ""), size=9),
        _text(page_w - 180, TOP - 12, f"{visitor} at {home}", size=9),
        _text(
            page_w - 180,
            TOP - 24,
            f"Game {game.get('game_number') or 1} · {game.get('game_type') or ''}",
            size=9,
        ),
        _text(page_w - 180, TOP - 36, str(game.get("day_night") or ""), size=9),
    ]
    y = TOP - 48
    block, y = _lineup_block(visitor, game.get("visitor_lineup") or [], y, page_w)
    cmds.append(block)
    cmds.append(_line(LEFT, y, page_w - RIGHT, y))
    y -= 14
    cmds.append(
        _text(
            LEFT,
            y,
            (
                f"{visitor} G{game.get('visitor_team_game_number')} · "
                f"{home} G{game.get('home_team_game_number')} · "
                f"Series {game.get('series_id')} "
                f"{game.get('series_game_index')}/{game.get('series_game_count')}"
            ),
            size=9,
        )
    )
    y -= 18
    block, y = _lineup_block(home, game.get("home_lineup") or [], y, page_w)
    cmds.append(block)
    visitor_pitch = (game.get("visitor_pitcher") or {}).get("display_name") or ""
    home_pitch = (game.get("home_pitcher") or {}).get("display_name") or ""
    cmds.append(_line(LEFT, y, page_w - RIGHT, y))
    cmds.append(_text(LEFT, y - 16, f"Visitor SP: {visitor_pitch}", size=10))
    cmds.append(_text(LEFT, y - 30, f"Home SP: {home_pitch}", size=10))
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
