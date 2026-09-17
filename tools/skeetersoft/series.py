"""Deterministic series segmentation for sandbox replay games."""

from __future__ import annotations

from collections import defaultdict
from datetime import date

DEFAULT_MAX_GAP_DAYS = 4


def _as_date(value: str) -> date:
    return date.fromisoformat(value)


def segment_series(games: list[dict], max_gap_days: int = DEFAULT_MAX_GAP_DAYS) -> list[dict]:
    """Assign series_id / ordinal fields. Every game belongs to exactly one series."""
    ordered = sorted(
        games,
        key=lambda g: (g["date"], int(g.get("game_number") or 1), g["game_id"]),
    )
    appearances: dict[str, list[dict]] = defaultdict(list)
    for game in ordered:
        appearances[game["home"]].append(game)
        appearances[game["visitor"]].append(game)

    def played_other_opponent(team: str, home: str, visitor: str, start: str, end: str) -> bool:
        for game in appearances[team]:
            if game["date"] <= start or game["date"] >= end:
                continue
            opp_home, opp_visitor = game["home"], game["visitor"]
            if {opp_home, opp_visitor} != {home, visitor}:
                return True
            if (opp_home, opp_visitor) != (home, visitor):
                return True
        return False

    open_series: dict[tuple[str, str, str], dict] = {}
    series_games: dict[str, list[dict]] = {}
    series_counter = 0

    for game in ordered:
        key = (game["season"], game["home"], game["visitor"])
        current = open_series.get(key)
        start_new = current is None
        if current is not None:
            last = current["games"][-1]
            gap = _as_date(game["date"]) - _as_date(last["date"])
            type_changed = (game.get("game_type") or "Unknown") != (
                last.get("game_type") or "Unknown"
            )
            if gap.days < 0:
                start_new = True
            elif gap.days > max_gap_days:
                start_new = True
            elif type_changed:
                start_new = True
            elif played_other_opponent(
                game["home"], game["home"], game["visitor"], last["date"], game["date"]
            ) or played_other_opponent(
                game["visitor"], game["home"], game["visitor"], last["date"], game["date"]
            ):
                start_new = True
        if start_new:
            series_counter += 1
            series_id = f"S{series_counter:04d}"
            current = {"series_id": series_id, "games": []}
            open_series[key] = current
            series_games[series_id] = current["games"]
        current["games"].append(game)

    annotated = []
    for series_id, members in series_games.items():
        count = len(members)
        start_date = members[0]["date"]
        for index, game in enumerate(members, start=1):
            row = dict(game)
            row["series_id"] = series_id
            row["series_start_date"] = start_date
            row["series_game_index"] = index
            row["series_game_count"] = count
            annotated.append(row)

    team_game_numbers: dict[tuple[int, str], int] = defaultdict(int)
    for game in sorted(
        annotated,
        key=lambda g: (g["date"], int(g.get("game_number") or 1), g["game_id"]),
    ):
        for team_key in ("home", "visitor"):
            slot = (game["season"], game[team_key])
            team_game_numbers[slot] += 1
            game[f"{team_key}_team_game_number"] = team_game_numbers[slot]
    return annotated


def sort_print_order(games: list[dict]) -> list[dict]:
    series_meta = {}
    for game in games:
        meta = series_meta.setdefault(
            game["series_id"],
            {
                "series_start_date": game["series_start_date"],
                "home": game["home"],
                "visitor": game["visitor"],
                "series_id": game["series_id"],
            },
        )
        meta["series_start_date"] = min(meta["series_start_date"], game["series_start_date"])
    series_order = {
        item["series_id"]: index
        for index, item in enumerate(
            sorted(
                series_meta.values(),
                key=lambda m: (m["series_start_date"], m["home"], m["visitor"], m["series_id"]),
            )
        )
    }
    return sorted(
        games,
        key=lambda g: (
            series_order[g["series_id"]],
            g["date"],
            int(g.get("game_number") or 1),
            g["game_id"],
        ),
    )
