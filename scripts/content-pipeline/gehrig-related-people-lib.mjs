// #5087 -- the reference list of people related to Lou Gehrig's story, first slice: players.
// Pure functions: parse Retrosheet season roster files, work out each player's relation to Gehrig
// for each season, and build the idempotent SQL that fills gehrig_related_people and
// gehrig_related_person_seasons (migration 0092). The CLI does the downloading and the writing.
//
// Retrosheet roster files (<TEAM><year>.ROS, inside https://www.retrosheet.org/events/<year>eve.zip)
// hold one line per player on a team for a season: id,last,first,bats,throws,team,position.
//
// The information used here was obtained free of charge from and is copyrighted by Retrosheet.
// Interested parties may contact Retrosheet at "www.retrosheet.org".

export const FIRST_SEASON = 1923;
export const LAST_SEASON = 1939;
export const GEHRIG_RETROSHEET_ID = 'gehrl101';
export const GEHRIG_TEAM = 'NYA';

/** The eight American League clubs Gehrig's Yankees played in the regular season, 1923 to 1939. */
export const AL_TEAMS = new Set(['NYA', 'BOS', 'PHA', 'WS1', 'CLE', 'DET', 'CHA', 'SLA']);

/**
 * How a player on `team` relates to Gehrig: a Yankees teammate, an opponent in the American League,
 * or `other_league` (National League clubs met him only in a World Series or an All-Star game).
 */
export function relationForTeam(team) {
  const code = String(team ?? '').trim().toUpperCase();
  if (code === GEHRIG_TEAM) return 'teammate';
  if (AL_TEAMS.has(code)) return 'opponent';
  return 'other_league';
}

/** "Dahlgren" and "Babe" become "Babe Dahlgren". */
export function displayName(last, first) {
  return [first, last].map((part) => String(part ?? '').trim()).filter(Boolean).join(' ');
}

/**
 * Parses one roster file. Lines that do not have a Retrosheet id and a last name are skipped.
 * @param {string} text file contents
 * @param {number} season the season the file belongs to
 * @returns {{ retrosheetId: string, displayName: string, team: string, position: string, season: number, relation: string }[]}
 */
export function parseRosterFile(text, season) {
  const rows = [];
  for (const rawLine of String(text ?? '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const [id, last, first, , , team, position] = line.split(',').map((part) => part.trim());
    if (!/^[a-z]{4,5}[0-9]{3}$/.test(id ?? '') || !last || !team) continue;
    rows.push({
      retrosheetId: id,
      displayName: displayName(last, first),
      team: team.toUpperCase(),
      position: position ?? '',
      season,
      relation: relationForTeam(team),
    });
  }
  return rows;
}

/**
 * Groups roster rows into one entry per person: name, the first and last season on a roster, the
 * strongest relation (a teammate in any season outranks an opponent, which outranks other_league),
 * and each season-and-team appearance. Gehrig himself is left out.
 */
export function groupPeople(rows) {
  const rank = { teammate: 3, opponent: 2, other_league: 1 };
  const people = new Map();
  for (const row of rows) {
    if (row.retrosheetId === GEHRIG_RETROSHEET_ID) continue;
    let person = people.get(row.retrosheetId);
    if (!person) {
      person = { retrosheetId: row.retrosheetId, displayName: row.displayName, yearFrom: row.season, yearTo: row.season, relation: row.relation, seasons: [] };
      people.set(row.retrosheetId, person);
    }
    person.yearFrom = Math.min(person.yearFrom, row.season);
    person.yearTo = Math.max(person.yearTo, row.season);
    if (rank[row.relation] > rank[person.relation]) person.relation = row.relation;
    if (!person.seasons.some((s) => s.season === row.season && s.team === row.team)) {
      person.seasons.push({ season: row.season, team: row.team, position: row.position, relation: row.relation });
    }
  }
  return [...people.values()].sort((a, b) => a.retrosheetId.localeCompare(b.retrosheetId));
}

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/**
 * Idempotent SQL for a list of grouped people. Re-running updates names, windows and relations of
 * rows this loader owns (source = 'retrosheet') and never touches permission_status, review fields
 * or rows from other sources.
 * @returns {string[]} one statement per entry
 */
export function buildUpsertStatements(people) {
  const statements = [];
  for (const person of people) {
    statements.push(
      `INSERT INTO gehrig_related_people (retrosheet_id, display_name, relation, year_from, year_to, source) ` +
        `VALUES (${sqlString(person.retrosheetId)}, ${sqlString(person.displayName)}, ${sqlString(person.relation)}, ${person.yearFrom}, ${person.yearTo}, 'retrosheet') ` +
        `ON CONFLICT(retrosheet_id) DO UPDATE SET display_name = excluded.display_name, relation = excluded.relation, ` +
        `year_from = excluded.year_from, year_to = excluded.year_to, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') ` +
        `WHERE gehrig_related_people.source = 'retrosheet';`,
    );
    for (const s of person.seasons) {
      statements.push(
        `INSERT OR REPLACE INTO gehrig_related_person_seasons (person_id, season, team, position, relation) ` +
          `SELECT id, ${s.season}, ${sqlString(s.team)}, ${sqlString(s.position)}, ${sqlString(s.relation)} ` +
          `FROM gehrig_related_people WHERE retrosheet_id = ${sqlString(person.retrosheetId)} AND source = 'retrosheet';`,
      );
    }
  }
  return statements;
}

/** The "was this person related to Gehrig in this year" question the subject gate asks. */
export function buildRelatedInYearSql() {
  return `SELECT p.id, p.display_name, s.team, s.relation
            FROM gehrig_related_people p
            JOIN gehrig_related_person_seasons s ON s.person_id = p.id
           WHERE p.display_name = ? AND s.season = ? AND p.permission_status <> 'denied'
           ORDER BY s.relation, s.team`;
}

/** The statement Retrosheet requires wherever its data is shown or redistributed. */
export const RETROSHEET_NOTICE =
  'The information used here was obtained free of charge from and is copyrighted by Retrosheet. Interested parties may contact Retrosheet at "www.retrosheet.org".';
