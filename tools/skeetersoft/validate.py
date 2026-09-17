"""Invariant checks for a compiled sandbox print stream."""

from __future__ import annotations


def validate_print_stream(games: list[dict]) -> list[str]:
    errors = []
    seen_ids = set()
    membership = {}
    for game in games:
        game_id = game["game_id"]
        if game_id in seen_ids:
            errors.append(f"duplicate game_id in print stream: {game_id}")
        seen_ids.add(game_id)
        series_id = game.get("series_id")
        if not series_id:
            errors.append(f"{game_id} missing series_id")
        else:
            membership.setdefault(series_id, []).append(game)
        for side in ("home_lineup", "visitor_lineup"):
            lineup = game.get(side) or []
            if len(lineup) != 9:
                errors.append(f"{game_id} {side} does not have 9 slots")
            for player in lineup:
                if not player.get("source_reference") and not player.get("source"):
                    errors.append(f"{game_id} {player.get('player_id')} missing source reference")
                if not player.get("display_name"):
                    errors.append(f"{game_id} {player.get('player_id')} missing display_name")
        if game.get("season") < 1976 or game.get("season") > 1985:
            errors.append(f"{game_id} season out of bounds")
    for series_id, members in membership.items():
        homes = {m["home"] for m in members}
        visitors = {m["visitor"] for m in members}
        if len(homes) != 1 or len(visitors) != 1:
            errors.append(f"{series_id} spans multiple matchup orientations")
        dates = [m["date"] for m in members]
        if dates != sorted(dates):
            errors.append(f"{series_id} games are not date-ordered")
    if len(membership) != len({g.get("series_id") for g in games}):
        errors.append("series membership accounting mismatch")
    return errors
