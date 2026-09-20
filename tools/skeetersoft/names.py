"""Display-name collision rules for a single team's game lineup."""

from __future__ import annotations

import re
import unicodedata


def normalize_compare_key(text: str) -> str:
    folded = unicodedata.normalize("NFKC", text or "")
    folded = re.sub(r"\s+", " ", folded).strip().casefold()
    return folded


def format_with_given_prefix(given: str, surname: str, suffix: str, prefix_len: int) -> str:
    given = (given or "").strip()
    surname = (surname or "").strip()
    suffix = (suffix or "").strip()
    if prefix_len <= 0 or not given:
        label = surname
    elif prefix_len >= len(given):
        label = f"{given} {surname}".strip()
    else:
        label = f"{given[:prefix_len]}. {surname}".strip()
    if suffix:
        label = f"{label} {suffix}".strip()
    return label


def display_names_for_side(players: list[dict]) -> dict[str, str]:
    """Return player_id -> display_name for one lineup side.

    Unique normalized surname displays the surname (plus suffix) alone.
    Colliding surnames use the shortest unambiguous given-name prefix.
    """
    by_id: dict[str, dict] = {}
    groups: dict[str, list[str]] = {}
    for player in players:
        player_id = player["player_id"]
        if player_id in by_id:
            raise ValueError(f"duplicate player_id in lineup: {player_id}")
        by_id[player_id] = player
        key = normalize_compare_key(player.get("surname") or "")
        groups.setdefault(key, []).append(player_id)

    displays: dict[str, str] = {}
    for player_ids in groups.values():
        if len(player_ids) == 1:
            player = by_id[player_ids[0]]
            displays[player_ids[0]] = format_with_given_prefix(
                "", player.get("surname") or "", player.get("suffix") or "", 0
            )
            continue

        cohort = [by_id[pid] for pid in player_ids]
        max_given = max((len((p.get("given") or "").strip()) for p in cohort), default=1)
        chosen = None
        for prefix_len in range(1, max_given + 1):
            labels = {
                p["player_id"]: format_with_given_prefix(
                    p.get("given") or "",
                    p.get("surname") or "",
                    p.get("suffix") or "",
                    prefix_len,
                )
                for p in cohort
            }
            if len(set(labels.values())) == len(labels):
                chosen = labels
                break
        if chosen is None:
            chosen = {
                p["player_id"]: f"{(p.get('source_name') or p['player_id']).strip()} ({p['player_id']})"
                for p in cohort
            }
        displays.update(chosen)
    return displays
