"""Download and parse Retrosheet regular-season event files for 1976–1985."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

from .parse import ParseError, parse_iso_date

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "input" / "cache"
RETROSHEET_NOTICE = (
    "The information used here was obtained free of charge from and is copyrighted by "
    "Retrosheet. Interested parties may contact Retrosheet at 20 Sunset Rd., Newark, DE 19711."
)
YEAR_URL = "https://www.retrosheet.org/events/{year}eve.zip"
YEARS = tuple(range(1976, 1986))


def split_event_line(line: str) -> list[str]:
    out: list[str] = []
    cur: list[str] = []
    quoted = False
    for char in line.rstrip("\r\n"):
        if char == '"':
            quoted = not quoted
            continue
        if char == "," and not quoted:
            out.append("".join(cur))
            cur = []
            continue
        cur.append(char)
    out.append("".join(cur))
    return out


def split_retrosheet_name(label: str) -> dict:
    text = (label or "").strip().strip('"')
    if "," in text:
        surname, rest = text.split(",", 1)
        tokens = rest.strip().split()
        suffix = ""
        if tokens:
            last = tokens[-1].rstrip(".")
            if last in {"Jr", "Sr", "II", "III", "IV"}:
                suffix = last
                tokens = tokens[:-1]
        return {"given": " ".join(tokens).strip(), "surname": surname.strip(), "suffix": suffix}
    tokens = text.split()
    suffix = ""
    if tokens:
        last = tokens[-1].rstrip(".")
        if last in {"Jr", "Sr", "II", "III", "IV"}:
            suffix = last
            tokens = tokens[:-1]
    if len(tokens) >= 2:
        return {"given": " ".join(tokens[:-1]), "surname": tokens[-1], "suffix": suffix}
    return {"given": "", "surname": text, "suffix": suffix}


def _empty_game(game_id: str, source_file: str) -> dict:
    return {
        "game_id": game_id,
        "date": None,
        "season": None,
        "home": None,
        "visitor": None,
        "game_number": 1,
        "day_night": "Unknown",
        "game_type": "Regular",
        "source": {"file": source_file, "class": "retrosheet-event", "notice": RETROSHEET_NOTICE},
        "visitor_lineup": [],
        "home_lineup": [],
        "visitor_pitcher_id": None,
        "home_pitcher_id": None,
        "register": {},
    }


def _apply_start(game: dict, fields: list[str], source_file: str) -> None:
    if len(fields) < 6:
        return
    player_id = fields[1]
    names = split_retrosheet_name(fields[2])
    side_code = fields[3]
    try:
        slot = int(fields[4])
    except ValueError:
        return
    field_pos = fields[5] if len(fields) > 5 else ""
    row = {
        "slot": slot,
        "player_id": player_id,
        "source_name": fields[2].strip().strip('"'),
        "field": field_pos,
        "source": {"file": source_file, "field": "start"},
        **names,
    }
    game["register"][player_id] = {
        "given": names["given"],
        "surname": names["surname"],
        "suffix": names["suffix"],
    }
    batting = 1 <= slot <= 9
    if side_code == "0":
        if batting:
            game["visitor_lineup"].append(row)
        if field_pos == "1" and not game["visitor_pitcher_id"]:
            game["visitor_pitcher_id"] = player_id
    elif side_code == "1":
        if batting:
            game["home_lineup"].append(row)
        if field_pos == "1" and not game["home_pitcher_id"]:
            game["home_pitcher_id"] = player_id


def parse_event_text(text: str, source_file: str) -> tuple[list[dict], dict]:
    games: list[dict] = []
    register: dict = {}
    current = None

    def close_current() -> None:
        nonlocal current
        if current is None:
            return
        games.append(current)
        register.update(current.pop("register", {}))
        current = None

    for raw_line in text.splitlines():
        if not raw_line or raw_line.startswith("#"):
            continue
        fields = split_event_line(raw_line)
        kind = fields[0]
        if kind == "id":
            close_current()
            current = _empty_game(fields[1] if len(fields) > 1 else "", source_file)
            continue
        if current is None:
            continue
        if kind == "info" and len(fields) >= 3:
            key, value = fields[1], fields[2]
            if key == "date":
                iso = value.replace("/", "-")
                current["date"] = iso
                if len(iso) >= 4 and iso[:4].isdigit():
                    current["season"] = int(iso[:4])
            elif key == "hometeam":
                current["home"] = value
            elif key == "visteam":
                current["visitor"] = value
            elif key == "number":
                try:
                    number = int(value)
                except ValueError:
                    number = 0
                current["game_number"] = 1 if number == 0 else number
            elif key == "daynight":
                current["day_night"] = value or "Unknown"
        elif kind == "start":
            _apply_start(current, fields, source_file)
    close_current()
    return games, register


def parse_event_file(path: Path) -> tuple[list[dict], dict]:
    text = path.read_text(encoding="latin-1")
    return parse_event_text(text, path.name)


def download_year(year: int, cache_dir: Path = CACHE, opener=urlopen) -> Path:
    cache_dir.mkdir(parents=True, exist_ok=True)
    dest = cache_dir / f"{year}eve.zip"
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    url = YEAR_URL.format(year=year)
    request = Request(url, headers={"User-Agent": "lgfc-skeetersoft-replay-ledger/0.2"})
    try:
        with opener(request, timeout=60) as response:
            dest.write_bytes(response.read())
    except (HTTPError, URLError, TimeoutError, OSError) as exc:
        dest.unlink(missing_ok=True)
        raise ParseError("unavailable_season", f"could not download {url}: {exc}") from exc
    return dest


def extract_event_files(zip_path: Path, dest_dir: Path) -> list[Path]:
    dest_dir.mkdir(parents=True, exist_ok=True)
    extracted: list[Path] = []
    with zipfile.ZipFile(zip_path) as archive:
        for info in archive.infolist():
            name = Path(info.filename).name
            suffix = Path(name).suffix.upper()
            if suffix not in {".EVN", ".EVA"}:
                continue
            target = dest_dir / name
            target.write_bytes(archive.read(info))
            extracted.append(target)
    return sorted(extracted)


def ingest_years(years=YEARS, cache_dir: Path = CACHE) -> dict:
    games: list[dict] = []
    register: dict = {}
    unavailable: list[dict] = []
    sources: list[str] = []
    for year in years:
        year_dir = cache_dir / str(year)
        try:
            zip_path = download_year(year, cache_dir)
            files = extract_event_files(zip_path, year_dir)
        except ParseError as exc:
            unavailable.append({"year": year, "code": exc.code, "message": exc.message})
            continue
        if not files:
            unavailable.append(
                {"year": year, "code": "unavailable_season", "message": f"{zip_path.name} had no EVN/EVA files"}
            )
            continue
        for path in files:
            parsed, names = parse_event_file(path)
            games.extend(parsed)
            register.update(names)
            sources.append(path.name)
    return {
        "games": games,
        "register": register,
        "unavailable": unavailable,
        "sources": sources,
        "notice": RETROSHEET_NOTICE,
    }


def event_games_to_records(games: list[dict]) -> list[dict]:
    records = []
    for game in games:
        if not game.get("date"):
            continue
        try:
            game["date"] = parse_iso_date(str(game["date"]).replace("/", "-"), game.get("game_id"))
        except ParseError:
            continue
        if not game.get("season"):
            game["season"] = int(game["date"][:4])
        records.append(game)
    return records
