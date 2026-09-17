"""Synthetic #3969 pilot fixtures. No Retrosheet/Chadwick bulk data."""

from __future__ import annotations

TEAM_ALIASES = {
    "1985": {
        "KCA": "KCA",
        "TOR": "TOR",
        "SDN": "SDN",
        "SFN": "SFN",
        "NYA": "NYA",
        "BOS": "BOS",
        "DET": "DET",
        "CHW": "CHW",
        "PIT": "PIT",
        "CHN": "CHN",
        "CLE": "CLE",
        "MIL": "MIL",
    }
}

REGISTER = {
    "SYN-TOR-1": {"given": "George", "surname": "Bell", "suffix": ""},
    "SYN-TOR-2": {"given": "Lloyd", "surname": "Moseby", "suffix": ""},
    "SYN-TOR-3": {"given": "Jesse", "surname": "Barfield", "suffix": ""},
    "SYN-TOR-4": {"given": "Willie", "surname": "Upshaw", "suffix": ""},
    "SYN-TOR-5": {"given": "Ernie", "surname": "Whitt", "suffix": ""},
    "SYN-TOR-6": {"given": "Damaso", "surname": "Garcia", "suffix": ""},
    "SYN-TOR-7": {"given": "Tony", "surname": "Fernandez", "suffix": ""},
    "SYN-TOR-8": {"given": "Garth", "surname": "Iorg", "suffix": ""},
    "SYN-TOR-9": {"given": "Dave", "surname": "Stieb", "suffix": ""},
    "SYN-KCA-1": {"given": "Willie", "surname": "Wilson", "suffix": ""},
    "SYN-KCA-2": {"given": "George", "surname": "Brett", "suffix": ""},
    "SYN-KCA-3": {"given": "Hal", "surname": "McRae", "suffix": ""},
    "SYN-KCA-4": {"given": "Steve", "surname": "Balboni", "suffix": ""},
    "SYN-KCA-5": {"given": "Frank", "surname": "White", "suffix": ""},
    "SYN-KCA-6": {"given": "Darryl", "surname": "Motley", "suffix": ""},
    "SYN-KCA-7": {"given": "Jorge", "surname": "Orta", "suffix": ""},
    "SYN-KCA-8": {"given": "Jim", "surname": "Sundberg", "suffix": ""},
    "SYN-KCA-9": {"given": "Bud", "surname": "Black", "suffix": ""},
    "SYN-SFN-C": {"given": "Chili", "surname": "Davis", "suffix": ""},
    "SYN-SFN-M": {"given": "Mark", "surname": "Davis", "suffix": ""},
    "SYN-SFN-3": {"given": "Jeffrey", "surname": "Leonard", "suffix": ""},
    "SYN-SFN-4": {"given": "Bob", "surname": "Brenly", "suffix": ""},
    "SYN-SFN-5": {"given": "Dan", "surname": "Gladden", "suffix": ""},
    "SYN-SFN-6": {"given": "Manny", "surname": "Trillo", "suffix": ""},
    "SYN-SFN-7": {"given": "Jose", "surname": "Uribe", "suffix": ""},
    "SYN-SFN-8": {"given": "David", "surname": "Green", "suffix": ""},
    "SYN-SFN-9": {"given": "Atlee", "surname": "Hammaker", "suffix": ""},
    "SYN-SDN-1": {"given": "Steve", "surname": "Garvey", "suffix": ""},
    "SYN-SDN-2": {"given": "Tony", "surname": "Gwynn", "suffix": ""},
    "SYN-SDN-3": {"given": "Graig", "surname": "Nettles", "suffix": ""},
    "SYN-SDN-4": {"given": "Terry", "surname": "Kennedy", "suffix": ""},
    "SYN-SDN-5": {"given": "Kevin", "surname": "McReynolds", "suffix": ""},
    "SYN-SDN-6": {"given": "Carmelo", "surname": "Martinez", "suffix": ""},
    "SYN-SDN-7": {"given": "Garry", "surname": "Templeton", "suffix": ""},
    "SYN-SDN-8": {"given": "Tim", "surname": "Flannery", "suffix": ""},
    "SYN-SDN-9": {"given": "LaMarr", "surname": "Hoyt", "suffix": ""},
    "SYN-INI-C1": {"given": "Carl", "surname": "Davis", "suffix": ""},
    "SYN-INI-C2": {"given": "Craig", "surname": "Davis", "suffix": ""},
    "SYN-INI-M": {"given": "Mark", "surname": "Davis", "suffix": ""},
    "SYN-INI-4": {"given": "Owen", "surname": "Unique", "suffix": ""},
    "SYN-INI-5": {"given": "Paul", "surname": "Solo", "suffix": ""},
    "SYN-INI-6": {"given": "Quinn", "surname": "Lone", "suffix": ""},
    "SYN-INI-7": {"given": "Ray", "surname": "Single", "suffix": ""},
    "SYN-INI-8": {"given": "Sam", "surname": "Only", "suffix": ""},
    "SYN-INI-9": {"given": "Tom", "surname": "Pitch", "suffix": ""},
    "SYN-INI-V1": {"given": "Uma", "surname": "Visit", "suffix": ""},
    "SYN-INI-V2": {"given": "Vic", "surname": "Guest", "suffix": ""},
    "SYN-INI-V3": {"given": "Wes", "surname": "Away", "suffix": ""},
    "SYN-INI-V4": {"given": "Xan", "surname": "Road", "suffix": ""},
    "SYN-INI-V5": {"given": "Yan", "surname": "Travel", "suffix": ""},
    "SYN-INI-V6": {"given": "Zed", "surname": "Trip", "suffix": ""},
    "SYN-INI-V7": {"given": "Abe", "surname": "Far", "suffix": ""},
    "SYN-INI-V8": {"given": "Ben", "surname": "Near", "suffix": ""},
    "SYN-INI-V9": {"given": "Cal", "surname": "Start", "suffix": ""},
    "SYN-PIT-VAN": {"given": "Andy", "surname": "Van Slyke", "suffix": "Jr"},
    "SYN-PIT-2": {"given": "Bill", "surname": "Madlock", "suffix": ""},
    "SYN-PIT-3": {"given": "Tony", "surname": "Pena", "suffix": ""},
    "SYN-PIT-4": {"given": "Johnny", "surname": "Ray", "suffix": ""},
    "SYN-PIT-5": {"given": "Marvell", "surname": "Wynne", "suffix": ""},
    "SYN-PIT-6": {"given": "Jason", "surname": "Thompson", "suffix": ""},
    "SYN-PIT-7": {"given": "Dale", "surname": "Berra", "suffix": ""},
    "SYN-PIT-8": {"given": "Jim", "surname": "Morrison", "suffix": ""},
    "SYN-PIT-9": {"given": "Rick", "surname": "Rhoden", "suffix": ""},
    "SYN-CHN-1": {"given": "Ryne", "surname": "Sandberg", "suffix": ""},
    "SYN-CHN-2": {"given": "Keith", "surname": "Moreland", "suffix": ""},
    "SYN-CHN-3": {"given": "Leon", "surname": "Durham", "suffix": ""},
    "SYN-CHN-4": {"given": "Jody", "surname": "Davis", "suffix": ""},
    "SYN-CHN-5": {"given": "Ron", "surname": "Cey", "suffix": ""},
    "SYN-CHN-6": {"given": "Bob", "surname": "Dernier", "suffix": ""},
    "SYN-CHN-7": {"given": "Larry", "surname": "Bowa", "suffix": ""},
    "SYN-CHN-8": {"given": "Gary", "surname": "Matthews", "suffix": ""},
    "SYN-CHN-9": {"given": "Rick", "surname": "Sutcliffe", "suffix": ""},
    "SYN-NYA-1": {"given": "Rickey", "surname": "Henderson", "suffix": ""},
    "SYN-NYA-2": {"given": "Don", "surname": "Mattingly", "suffix": ""},
    "SYN-NYA-3": {"given": "Dave", "surname": "Winfield", "suffix": ""},
    "SYN-NYA-4": {"given": "Don", "surname": "Baylor", "suffix": ""},
    "SYN-NYA-5": {"given": "Willie", "surname": "Randolph", "suffix": ""},
    "SYN-NYA-6": {"given": "Mike", "surname": "Pagliarulo", "suffix": ""},
    "SYN-NYA-7": {"given": "Ken", "surname": "Griffey", "suffix": ""},
    "SYN-NYA-8": {"given": "Butch", "surname": "Wynegar", "suffix": ""},
    "SYN-NYA-9": {"given": "Ron", "surname": "Guidry", "suffix": ""},
    "SYN-BOS-1": {"given": "Wade", "surname": "Boggs", "suffix": ""},
    "SYN-BOS-2": {"given": "Jim", "surname": "Rice", "suffix": ""},
    "SYN-BOS-3": {"given": "Dwight", "surname": "Evans", "suffix": ""},
    "SYN-BOS-4": {"given": "Bill", "surname": "Buckner", "suffix": ""},
    "SYN-BOS-5": {"given": "Tony", "surname": "Armas", "suffix": ""},
    "SYN-BOS-6": {"given": "Marty", "surname": "Barrett", "suffix": ""},
    "SYN-BOS-7": {"given": "Glenn", "surname": "Hoffman", "suffix": ""},
    "SYN-BOS-8": {"given": "Rich", "surname": "Gedman", "suffix": ""},
    "SYN-BOS-9": {"given": "Oil", "surname": "Can", "suffix": ""},
    "SYN-DET-1": {"given": "Lou", "surname": "Whitaker", "suffix": ""},
    "SYN-DET-2": {"given": "Alan", "surname": "Trammell", "suffix": ""},
    "SYN-DET-3": {"given": "Kirk", "surname": "Gibson", "suffix": ""},
    "SYN-DET-4": {"given": "Lance", "surname": "Parrish", "suffix": ""},
    "SYN-DET-5": {"given": "Chet", "surname": "Lemon", "suffix": ""},
    "SYN-DET-6": {"given": "Darrell", "surname": "Evans", "suffix": ""},
    "SYN-DET-7": {"given": "Larry", "surname": "Herndon", "suffix": ""},
    "SYN-DET-8": {"given": "Tom", "surname": "Brookens", "suffix": ""},
    "SYN-DET-9": {"given": "Jack", "surname": "Morris", "suffix": ""},
    "SYN-CHW-1": {"given": "Harold", "surname": "Baines", "suffix": ""},
    "SYN-CHW-2": {"given": "Carlton", "surname": "Fisk", "suffix": ""},
    "SYN-CHW-3": {"given": "Greg", "surname": "Walker", "suffix": ""},
    "SYN-CHW-4": {"given": "Ozzie", "surname": "Guillen", "suffix": ""},
    "SYN-CHW-5": {"given": "Julio", "surname": "Cruz", "suffix": ""},
    "SYN-CHW-6": {"given": "Rudy", "surname": "Law", "suffix": ""},
    "SYN-CHW-7": {"given": "Daryl", "surname": "Boston", "suffix": ""},
    "SYN-CHW-8": {"given": "Tim", "surname": "Hulett", "suffix": ""},
    "SYN-CHW-9": {"given": "Tom", "surname": "Seaver", "suffix": ""},
    "SYN-MIL-1": {"given": "Robin", "surname": "Yount", "suffix": ""},
    "SYN-MIL-2": {"given": "Paul", "surname": "Molitor", "suffix": ""},
    "SYN-MIL-3": {"given": "Cecil", "surname": "Cooper", "suffix": ""},
    "SYN-MIL-4": {"given": "Ben", "surname": "Oglivie", "suffix": ""},
    "SYN-MIL-5": {"given": "Jim", "surname": "Gantner", "suffix": ""},
    "SYN-MIL-6": {"given": "Ted", "surname": "Simmons", "suffix": ""},
    "SYN-MIL-7": {"given": "Rick", "surname": "Manning", "suffix": ""},
    "SYN-MIL-8": {"given": "Ernie", "surname": "Riles", "suffix": ""},
    "SYN-MIL-9": {"given": "Teddy", "surname": "Higuera", "suffix": ""},
    "SYN-CLE-1": {"given": "Brett", "surname": "Butler", "suffix": ""},
    "SYN-CLE-2": {"given": "Julio", "surname": "Franco", "suffix": ""},
    "SYN-CLE-3": {"given": "Andre", "surname": "Thornton", "suffix": ""},
    "SYN-CLE-4": {"given": "Pat", "surname": "Tabler", "suffix": ""},
    "SYN-CLE-5": {"given": "Tony", "surname": "Bernazard", "suffix": ""},
    "SYN-CLE-6": {"given": "Brook", "surname": "Jacoby", "suffix": ""},
    "SYN-CLE-7": {"given": "Carmen", "surname": "Castillo", "suffix": ""},
    "SYN-CLE-8": {"given": "Jerry", "surname": "Willard", "suffix": ""},
    "SYN-CLE-9": {"given": "Bert", "surname": "Blyleven", "suffix": ""},
    "SYN-DUP": {"given": "Duped", "surname": "Player", "suffix": ""},
}


def _name(player_id: str) -> str:
    rec = REGISTER[player_id]
    parts = [rec["given"], rec["surname"], rec["suffix"]]
    return " ".join(p for p in parts if p).strip()


def _lineup(player_ids: list[str], fields: list[str] | None = None) -> list[dict]:
    default_fields = ["LF", "CF", "RF", "1B", "C", "2B", "SS", "3B", "P"]
    use_fields = fields or default_fields
    rows = []
    for index, player_id in enumerate(player_ids, start=1):
        rows.append(
            {
                "slot": index,
                "player_id": player_id,
                "source_name": _name(player_id),
                "field": use_fields[index - 1],
            }
        )
    return rows


def _game(**kwargs) -> dict:
    kwargs.setdefault("season", 1985)
    kwargs.setdefault("game_number", 1)
    kwargs.setdefault("day_night", "D")
    kwargs.setdefault("game_type", "Regular Season")
    kwargs.setdefault(
        "source",
        {
            "file": "tools/skeetersoft/pilot_data.py",
            "class": "synthetic",
        },
    )
    return kwargs


TOR = [f"SYN-TOR-{n}" for n in range(1, 10)]
KCA = [f"SYN-KCA-{n}" for n in range(1, 10)]
SDN = [f"SYN-SDN-{n}" for n in range(1, 10)]
SFN = ["SYN-SFN-C", "SYN-SFN-M", "SYN-SFN-3", "SYN-SFN-4", "SYN-SFN-5", "SYN-SFN-6", "SYN-SFN-7", "SYN-SFN-8", "SYN-SFN-9"]
NYA = [f"SYN-NYA-{n}" for n in range(1, 10)]
BOS = [f"SYN-BOS-{n}" for n in range(1, 10)]
DET = [f"SYN-DET-{n}" for n in range(1, 10)]
CHW = [f"SYN-CHW-{n}" for n in range(1, 10)]
PIT = ["SYN-PIT-VAN"] + [f"SYN-PIT-{n}" for n in range(2, 10)]
CHN = [f"SYN-CHN-{n}" for n in range(1, 10)]
MIL = [f"SYN-MIL-{n}" for n in range(1, 10)]
CLE = [f"SYN-CLE-{n}" for n in range(1, 10)]
INI_HOME = ["SYN-INI-C1", "SYN-INI-C2", "SYN-INI-M", "SYN-INI-4", "SYN-INI-5", "SYN-INI-6", "SYN-INI-7", "SYN-INI-8", "SYN-INI-9"]
INI_VIS = [f"SYN-INI-V{n}" for n in range(1, 10)]


ACCEPTED_GAMES = [
    _game(
        fixture_id="F-LAYOUT-1985-OPEN",
        game_id="SYN-1985-LAYOUT",
        date="1985-04-08",
        home="KCA",
        visitor="TOR",
        game_type="Opening Day",
        visitor_lineup=_lineup(TOR),
        home_lineup=_lineup(KCA),
        visitor_pitcher_id="SYN-TOR-9",
        home_pitcher_id="SYN-KCA-9",
        source={"file": "tools/skeetersoft/pilot_data.py", "class": "synthetic-from-blueprint"},
    ),
    _game(
        fixture_id="F-COLLIDE-DAVIS",
        game_id="SYN-1985-DAVIS",
        date="1985-05-15",
        home="SFN",
        visitor="SDN",
        visitor_lineup=_lineup(SDN),
        home_lineup=_lineup(SFN),
        visitor_pitcher_id="SYN-SDN-9",
        home_pitcher_id="SYN-SFN-9",
        source={"file": "tools/skeetersoft/pilot_data.py", "class": "synthetic"},
    ),
    _game(
        fixture_id="F-COLLIDE-INITIAL",
        game_id="SYN-1985-INITIAL",
        date="1985-05-20",
        home="BOS",
        visitor="NYA",
        visitor_lineup=_lineup(INI_VIS),
        home_lineup=_lineup(INI_HOME),
        visitor_pitcher_id="SYN-INI-V9",
        home_pitcher_id="SYN-INI-9",
        source={"file": "tools/skeetersoft/pilot_data.py", "class": "synthetic"},
    ),
    _game(
        fixture_id="F-NAME-COMPOUND",
        game_id="SYN-1985-COMPOUND",
        date="1985-05-01",
        home="CHN",
        visitor="PIT",
        visitor_lineup=_lineup(PIT),
        home_lineup=_lineup(CHN),
        visitor_pitcher_id="SYN-PIT-9",
        home_pitcher_id="SYN-CHN-9",
        source={"file": "tools/skeetersoft/pilot_data.py", "class": "synthetic"},
    ),
    _game(
        fixture_id="F-DH",
        game_id="SYN-1985-DH-1",
        date="1985-06-01",
        home="BOS",
        visitor="NYA",
        game_number=1,
        visitor_lineup=_lineup(NYA),
        home_lineup=_lineup(BOS),
        visitor_pitcher_id="SYN-NYA-9",
        home_pitcher_id="SYN-BOS-9",
    ),
    _game(
        fixture_id="F-DH",
        game_id="SYN-1985-DH-2",
        date="1985-06-01",
        home="BOS",
        visitor="NYA",
        game_number=2,
        visitor_lineup=_lineup(NYA),
        home_lineup=_lineup(BOS),
        visitor_pitcher_id="SYN-NYA-9",
        home_pitcher_id="SYN-BOS-9",
    ),
    _game(
        fixture_id="F-OFFDAY",
        game_id="SYN-1985-OFF-1",
        date="1985-06-10",
        home="CHW",
        visitor="DET",
        visitor_lineup=_lineup(DET),
        home_lineup=_lineup(CHW),
        visitor_pitcher_id="SYN-DET-9",
        home_pitcher_id="SYN-CHW-9",
    ),
    _game(
        fixture_id="F-OFFDAY",
        game_id="SYN-1985-OFF-2",
        date="1985-06-12",
        home="CHW",
        visitor="DET",
        visitor_lineup=_lineup(DET),
        home_lineup=_lineup(CHW),
        visitor_pitcher_id="SYN-DET-9",
        home_pitcher_id="SYN-CHW-9",
    ),
    _game(
        fixture_id="F-SPLIT-OPP",
        game_id="SYN-1985-SPLIT-1",
        date="1985-07-01",
        home="KCA",
        visitor="TOR",
        visitor_lineup=_lineup(TOR),
        home_lineup=_lineup(KCA),
        visitor_pitcher_id="SYN-TOR-9",
        home_pitcher_id="SYN-KCA-9",
    ),
    _game(
        fixture_id="F-SPLIT-OPP",
        game_id="SYN-1985-SPLIT-MID",
        date="1985-07-02",
        home="BOS",
        visitor="TOR",
        visitor_lineup=_lineup(TOR),
        home_lineup=_lineup(BOS),
        visitor_pitcher_id="SYN-TOR-9",
        home_pitcher_id="SYN-BOS-9",
    ),
    _game(
        fixture_id="F-SPLIT-OPP",
        game_id="SYN-1985-SPLIT-2",
        date="1985-07-03",
        home="KCA",
        visitor="TOR",
        visitor_lineup=_lineup(TOR),
        home_lineup=_lineup(KCA),
        visitor_pitcher_id="SYN-TOR-9",
        home_pitcher_id="SYN-KCA-9",
    ),
    _game(
        fixture_id="F-REVERSE",
        game_id="SYN-1985-REV-1",
        date="1985-08-01",
        home="KCA",
        visitor="TOR",
        visitor_lineup=_lineup(TOR),
        home_lineup=_lineup(KCA),
        visitor_pitcher_id="SYN-TOR-9",
        home_pitcher_id="SYN-KCA-9",
    ),
    _game(
        fixture_id="F-REVERSE",
        game_id="SYN-1985-REV-2",
        date="1985-08-02",
        home="TOR",
        visitor="KCA",
        visitor_lineup=_lineup(KCA),
        home_lineup=_lineup(TOR),
        visitor_pitcher_id="SYN-KCA-9",
        home_pitcher_id="SYN-TOR-9",
    ),
]


def _failure_base():
    return _game(
        game_id="SYN-FAIL-BASE",
        date="1985-09-01",
        home="KCA",
        visitor="TOR",
        visitor_lineup=_lineup(TOR),
        home_lineup=_lineup(KCA),
        visitor_pitcher_id="SYN-TOR-9",
        home_pitcher_id="SYN-KCA-9",
    )


FAILURE_GAMES = [
    {
        **_failure_base(),
        "fixture_id": "F-MISS-LINEUP",
        "game_id": "SYN-FAIL-MISS-LINEUP",
        "visitor_lineup": None,
    },
    {
        **_failure_base(),
        "fixture_id": "F-BAD-DATE",
        "game_id": "SYN-FAIL-BAD-DATE",
        "date": "1985-13-40",
    },
    {
        **_failure_base(),
        "fixture_id": "F-DUP-GAME",
        "game_id": "SYN-FAIL-DUP-GAME",
        "date": "1985-09-02",
    },
    {
        **_failure_base(),
        "fixture_id": "F-DUP-GAME",
        "game_id": "SYN-FAIL-DUP-GAME",
        "date": "1985-09-03",
    },
    {
        **_failure_base(),
        "fixture_id": "F-DUP-PLAYER",
        "game_id": "SYN-FAIL-DUP-PLAYER",
        "home_lineup": _lineup(["SYN-DUP"] * 9),
    },
    {
        **_failure_base(),
        "fixture_id": "F-BAD-ALIAS",
        "game_id": "SYN-FAIL-BAD-ALIAS",
        "home": "ZZZ",
    },
]
