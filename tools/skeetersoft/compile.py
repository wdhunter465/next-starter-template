"""Compile accepted sandbox games into a canonical print stream."""

from __future__ import annotations

from copy import deepcopy

from .names import display_names_for_side
from .parse import ParseError, validate_game
from .pilot_data import REGISTER, TEAM_ALIASES
from .series import segment_series, sort_print_order
from .teams import merge_aliases


def enrich_side(lineup: list[dict], register: dict) -> list[dict]:
    enriched = []
    for row in lineup:
        rec = register.get(row["player_id"])
        if rec is None:
            raise ParseError(
                "unknown_player",
                f"player_id {row['player_id']} is not in the player register",
                None,
            )
        item = dict(row)
        item["given"] = rec.get("given") or ""
        item["surname"] = rec.get("surname") or ""
        item["suffix"] = rec.get("suffix") or ""
        item["original_full_name"] = row.get("source_name") or ""
        enriched.append(item)
    displays = display_names_for_side(enriched)
    for item in enriched:
        item["display_name"] = displays[item["player_id"]]
        item["source_reference"] = item.get("source") or {"file": "register"}
    return enriched


def pitcher_record(player_id: str | None, lineup: list[dict], register: dict) -> dict | None:
    if not player_id:
        return None
    match = next((row for row in lineup if row["player_id"] == player_id), None)
    rec = register.get(player_id) or {}
    return {
        "player_id": player_id,
        "display_name": (match or {}).get("display_name")
        or rec.get("surname")
        or player_id,
        "source_name": (match or {}).get("source_name") or "",
        "source_reference": {"file": "register", "player_id": player_id},
    }


def compile_records(raw_games: list[dict], aliases=None, register=None, seen_ids=None):
    aliases = aliases if aliases is not None else merge_aliases(TEAM_ALIASES)
    register = register if register is not None else REGISTER
    seen_ids = seen_ids if seen_ids is not None else set()
    accepted = []
    exceptions = []
    for raw in raw_games:
        try:
            game = validate_game(deepcopy(raw), aliases, seen_ids)
            game["visitor_lineup"] = enrich_side(game["visitor_lineup"], register)
            game["home_lineup"] = enrich_side(game["home_lineup"], register)
            game["visitor_pitcher"] = pitcher_record(
                game.get("visitor_pitcher_id"), game["visitor_lineup"], register
            )
            game["home_pitcher"] = pitcher_record(
                game.get("home_pitcher_id"), game["home_lineup"], register
            )
            accepted.append(game)
        except ParseError as exc:
            if exc.game_id is None:
                exc.game_id = raw.get("game_id")
            payload = exc.as_dict()
            payload["fixture_id"] = raw.get("fixture_id")
            payload["source"] = raw.get("source")
            exceptions.append(payload)
    if accepted:
        accepted = sort_print_order(segment_series(accepted))
    return {"accepted": accepted, "exceptions": exceptions}


def coverage_report(compiled: dict, note: str | None = None) -> dict:
    by_season: dict[str, dict] = {}
    collision_games = 0
    for game in compiled["accepted"]:
        season = str(game["season"])
        row = by_season.setdefault(
            season,
            {"accepted_games": 0, "pages": 0, "series_ids": set(), "unavailable_fields": []},
        )
        row["accepted_games"] += 1
        row["pages"] += 1
        row["series_ids"].add(game["series_id"])
        for side in ("home_lineup", "visitor_lineup"):
            surnames = [p["surname"] for p in game[side]]
            if len(surnames) != len(set(surnames)):
                collision_games += 1
                break
        if game.get("day_night") == "Unknown":
            row["unavailable_fields"].append({"game_id": game["game_id"], "field": "day_night"})
    seasons = {}
    for season, row in by_season.items():
        seasons[season] = {
            "accepted_games": row["accepted_games"],
            "pages": row["pages"],
            "series_count": len(row["series_ids"]),
            "unavailable_fields": row["unavailable_fields"],
        }
    return {
        "seasons": seasons,
        "accepted_games": len(compiled["accepted"]),
        "rejected_games": len(compiled["exceptions"]),
        "series_count": len({g["series_id"] for g in compiled["accepted"]}),
        "collision_games": collision_games,
        "unavailable_seasons": [
            year for year in range(1976, 1986) if str(year) not in seasons
        ],
        "note": note
        or "Pilot uses synthetic 1985 fixtures only. Full 1976-1985 uses Retrosheet ingest on the sandbox branch.",
    }
