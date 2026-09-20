"""1976–1985 Retrosheet team identities. Season tables overlay this default."""

from __future__ import annotations

RETROSHEET_TEAMS = (
    "ATL",
    "BAL",
    "BOS",
    "CAL",
    "CHA",
    "CHN",
    "CIN",
    "CLE",
    "DET",
    "HOU",
    "KCA",
    "LAN",
    "MIL",
    "MIN",
    "MON",
    "NYA",
    "NYN",
    "OAK",
    "PHI",
    "PIT",
    "SDN",
    "SEA",
    "SFN",
    "SLN",
    "TEX",
    "TOR",
)

DEFAULT_TEAM_ALIASES = {code: code for code in RETROSHEET_TEAMS}
DEFAULT_TEAM_ALIASES["CHW"] = "CHW"


def merge_aliases(season_tables: dict | None = None) -> dict:
    merged = {"default": dict(DEFAULT_TEAM_ALIASES)}
    if season_tables:
        merged.update(season_tables)
    return merged
