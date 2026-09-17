"""Parse and validate sandbox game records. Fail closed; never silently fill facts."""

from __future__ import annotations

from calendar import monthrange
from datetime import date


class ParseError(Exception):
    def __init__(self, code: str, message: str, game_id: str | None = None):
        super().__init__(message)
        self.code = code
        self.game_id = game_id
        self.message = message

    def as_dict(self) -> dict:
        return {"code": self.code, "message": self.message, "game_id": self.game_id}


def parse_iso_date(value: str, game_id: str | None = None) -> str:
    if not isinstance(value, str) or not value:
        raise ParseError("invalid_date", "date is required as YYYY-MM-DD", game_id)
    parts = value.split("-")
    if len(parts) != 3 or not all(p.isdigit() for p in parts):
        raise ParseError("invalid_date", f"date is not ISO YYYY-MM-DD: {value!r}", game_id)
    year, month, day = (int(p) for p in parts)
    if month < 1 or month > 12:
        raise ParseError("invalid_date", f"invalid month in {value!r}", game_id)
    last = monthrange(year, month)[1]
    if day < 1 or day > last:
        raise ParseError("invalid_date", f"invalid day in {value!r}", game_id)
    return date(year, month, day).isoformat()


def resolve_team(abbrev: str, season: int, aliases: dict) -> str:
    table = aliases.get(str(season)) or aliases.get(season) or aliases.get("default") or {}
    if abbrev not in table:
        raise ParseError("unknown_team_alias", f"unknown team alias {abbrev!r} for season {season}")
    return table[abbrev]


def validate_lineup(lineup, game_id: str, side: str) -> list[dict]:
    if lineup is None:
        raise ParseError("missing_lineup", f"{side} lineup is missing", game_id)
    if not isinstance(lineup, list) or len(lineup) != 9:
        raise ParseError("missing_lineup", f"{side} lineup must have 9 slots", game_id)
    seen_slots = set()
    seen_players = set()
    rows = []
    for item in lineup:
        slot = int(item.get("slot") or 0)
        player_id = item.get("player_id")
        if slot < 1 or slot > 9:
            raise ParseError("invalid_lineup_slot", f"{side} has invalid slot {slot}", game_id)
        if slot in seen_slots:
            raise ParseError("invalid_lineup_slot", f"{side} duplicate slot {slot}", game_id)
        if not player_id:
            raise ParseError("missing_lineup", f"{side} slot {slot} missing player_id", game_id)
        if player_id in seen_players:
            raise ParseError("duplicate_player_id", f"{side} duplicate player_id {player_id}", game_id)
        seen_slots.add(slot)
        seen_players.add(player_id)
        rows.append(
            {
                "slot": slot,
                "player_id": player_id,
                "source_name": item.get("source_name") or "",
                "field": item.get("field") or "",
                "source": item.get("source") or {"file": "input", "field": f"{side}_lineup"},
            }
        )
    if seen_slots != set(range(1, 10)):
        raise ParseError("invalid_lineup_slot", f"{side} lineup slots are incomplete", game_id)
    return sorted(rows, key=lambda r: r["slot"])


def validate_game(raw: dict, aliases: dict, seen_ids: set[str]) -> dict:
    game_id = raw.get("game_id")
    if not game_id:
        raise ParseError("missing_game_id", "game_id is required")
    if game_id in seen_ids:
        raise ParseError("duplicate_game_id", f"duplicate game_id {game_id}", game_id)
    seen_ids.add(game_id)
    iso_date = parse_iso_date(raw.get("date"), game_id)
    season = int(raw.get("season") or iso_date[:4])
    if season < 1976 or season > 1985:
        raise ParseError("season_out_of_bounds", f"season {season} is outside 1976-1985", game_id)
    home = resolve_team(raw.get("home"), season, aliases)
    visitor = resolve_team(raw.get("visitor"), season, aliases)
    game_type = raw.get("game_type")
    if not game_type:
        game_type = "Unknown"
    return {
        "game_id": game_id,
        "date": iso_date,
        "season": season,
        "home": home,
        "visitor": visitor,
        "game_number": int(raw.get("game_number") or 1),
        "day_night": raw.get("day_night") or "Unknown",
        "game_type": game_type,
        "source": raw.get("source") or {"file": "unspecified", "class": "unknown"},
        "visitor_lineup": validate_lineup(raw.get("visitor_lineup"), game_id, "visitor"),
        "home_lineup": validate_lineup(raw.get("home_lineup"), game_id, "home"),
        "visitor_pitcher_id": raw.get("visitor_pitcher_id"),
        "home_pitcher_id": raw.get("home_pitcher_id"),
        "fixture_id": raw.get("fixture_id"),
    }
