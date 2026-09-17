"""Standalone Letter HTML render. HTML is the canonical print source."""

from __future__ import annotations

import html

CSS = """
@page { size: letter portrait; margin: 0; }
html, body {
  margin: 0;
  padding: 0;
  font-family: "Times New Roman", Times, serif;
  font-size: 10pt;
  color: #111;
}
.game-page {
  width: 8.5in;
  height: 11in;
  padding: 0.35in 0.35in 0.35in 0.85in;
  box-sizing: border-box;
  page-break-after: always;
  break-after: page;
  position: relative;
}
.game-page:last-child {
  page-break-after: auto;
  break-after: auto;
}
.meta {
  position: absolute;
  top: 0.35in;
  right: 0.35in;
  text-align: right;
  font-size: 9pt;
}
.team-block { margin-top: 0.15in; }
.team-block h2 {
  font-size: 12pt;
  margin: 0 0 0.08in 0;
}
table.lineup {
  width: 100%;
  border-collapse: collapse;
}
table.lineup th, table.lineup td {
  border: 0.3pt solid #222;
  padding: 0.04in 0.05in;
  text-align: center;
}
table.lineup td.name, table.lineup th.name {
  text-align: left;
  width: 1.7in;
}
.divider {
  margin: 0.18in 0;
  border-top: 2pt solid #222;
  padding-top: 0.08in;
  font-size: 9pt;
}
.pitcher {
  margin-top: 0.15in;
  min-height: 0.7in;
  border-top: 0.6pt solid #444;
  padding-top: 0.08in;
}
""".strip()


def _esc(value) -> str:
    return html.escape("" if value is None else str(value), quote=True)


def _lineup_table(title: str, lineup: list[dict]) -> str:
    innings = "".join(f"<th>{n}</th>" for n in range(1, 10))
    rows = []
    for player in lineup:
        cells = "".join("<td></td>" for _ in range(9))
        rows.append(
            "<tr>"
            f"<td class=\"name\">{_esc(player['display_name'])}</td>"
            f"<td>{_esc(player.get('field'))}</td>"
            f"{cells}"
            "<td></td><td></td><td></td><td></td>"
            "</tr>"
        )
    return (
        f"<section class=\"team-block\" data-side=\"{_esc(title)}\">"
        f"<h2>{_esc(title)}</h2>"
        "<table class=\"lineup\">"
        "<thead><tr>"
        "<th class=\"name\">Player</th><th>Pos</th>"
        f"{innings}<th>AB</th><th>R</th><th>H</th><th>RBI</th>"
        "</tr></thead>"
        f"<tbody>{''.join(rows)}</tbody>"
        "</table></section>"
    )


def render_game(game: dict) -> str:
    visitor = game["visitor"]
    home = game["home"]
    meta = (
        f"<div class=\"meta\">"
        f"<div>{_esc(game['date'])}</div>"
        f"<div>{_esc(visitor)} at {_esc(home)}</div>"
        f"<div>Game { _esc(game.get('game_number')) } · {_esc(game.get('game_type'))}</div>"
        f"<div>{_esc(game.get('day_night'))}</div>"
        f"</div>"
    )
    divider = (
        f"<div class=\"divider\">"
        f"{_esc(visitor)} G{_esc(game.get('visitor_team_game_number'))}"
        f" · {_esc(home)} G{_esc(game.get('home_team_game_number'))}"
        f" · Series { _esc(game.get('series_id')) } "
        f"{_esc(game.get('series_game_index'))}/{_esc(game.get('series_game_count'))}"
        f"</div>"
    )
    visitor_pitch = (game.get("visitor_pitcher") or {}).get("display_name") or ""
    home_pitch = (game.get("home_pitcher") or {}).get("display_name") or ""
    pitchers = (
        "<div class=\"pitcher\">"
        f"<div>Visitor SP: {_esc(visitor_pitch)}</div>"
        f"<div>Home SP: {_esc(home_pitch)}</div>"
        "</div>"
    )
    return (
        f"<article class=\"game-page\" id=\"{_esc(game['game_id'])}\" data-game-id=\"{_esc(game['game_id'])}\">"
        f"{meta}"
        f"{_lineup_table(visitor, game['visitor_lineup'])}"
        f"{divider}"
        f"{_lineup_table(home, game['home_lineup'])}"
        f"{pitchers}"
        "</article>"
    )


def render_ledger(games: list[dict]) -> str:
    pages = "\n".join(render_game(game) for game in games)
    return (
        "<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"utf-8\">"
        "<title>Skeetersoft Replay Ledger Pilot</title>"
        f"<style>{CSS}</style></head><body>\n{pages}\n</body></html>\n"
    )
