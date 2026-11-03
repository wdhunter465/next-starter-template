// Weekly Photo Matchup bracket (Product Authority direction 2026-11-03).
//
// Every eligible photo plays. Two are picked at random each week; when the week closes the
// winner is recorded and the loser is out. A tie advances BOTH photos. When a round has no
// unplayed photos left, the winners become the next round. When one photo is left (or a round
// eliminates nobody) the tournament is complete and a new one starts with every eligible
// photo. A photo added mid-tournament joins the current round.
//
// Storage: matchup_tournaments / matchup_entries / weekly_matchups result columns
// (migrations/0089_matchup_bracket.sql). Votes stay in weekly_votes, keyed by week; a new week
// starts at zero without deleting anything.

type Rng = () => number;

export type BracketPick = {
  photoAId: number;
  photoBId: number;
  tournamentId: number;
  round: number;
};

type Tournament = { id: number; current_round: number };

const nowIso = (): string => new Date().toISOString();

function shuffle<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

async function activeTournament(db: any): Promise<Tournament | null> {
  const row = await db
    .prepare("SELECT id, current_round FROM matchup_tournaments WHERE status = 'active' ORDER BY id DESC LIMIT 1;")
    .first();
  return row ? { id: Number(row.id), current_round: Number(row.current_round) } : null;
}

async function startTournament(db: any, eligibleIds: number[]): Promise<Tournament> {
  const out = await db
    .prepare("INSERT INTO matchup_tournaments (status, current_round) VALUES ('active', 1);")
    .run();
  const id = Number(out?.meta?.last_row_id || 0);
  if (!id) throw new Error('matchup bracket: could not start a tournament');
  const inserts = eligibleIds.map((photoId) =>
    db
      .prepare("INSERT OR IGNORE INTO matchup_entries (tournament_id, photo_id, round, status) VALUES (?, ?, 1, 'waiting');")
      .bind(id, photoId),
  );
  if (inserts.length) await db.batch(inserts);
  return { id, current_round: 1 };
}

async function completeTournament(db: any, tournamentId: number, championIds: number[]): Promise<void> {
  const statements = [
    db
      .prepare(
        "UPDATE matchup_tournaments SET status = 'complete', champion_photo_ids = ?, completed_at = ? WHERE id = ?;",
      )
      .bind(JSON.stringify(championIds), nowIso(), tournamentId),
  ];
  for (const photoId of championIds) {
    statements.push(
      db
        .prepare("UPDATE matchup_entries SET status = 'champion', decided_at = ? WHERE tournament_id = ? AND photo_id = ?;")
        .bind(nowIso(), tournamentId, photoId),
    );
  }
  await db.batch(statements);
}

/** New photos join the current round; photos no longer eligible leave the bracket. */
async function syncEntries(db: any, t: Tournament, eligibleIds: number[]): Promise<void> {
  const rows = await db
    .prepare('SELECT photo_id, status FROM matchup_entries WHERE tournament_id = ?;')
    .bind(t.id)
    .all();
  const existing = new Map<number, string>();
  for (const row of rows?.results ?? []) existing.set(Number(row.photo_id), String(row.status));
  const eligible = new Set(eligibleIds);

  const statements: any[] = [];
  for (const photoId of eligible) {
    const status = existing.get(photoId);
    if (status === undefined) {
      statements.push(
        db
          .prepare("INSERT OR IGNORE INTO matchup_entries (tournament_id, photo_id, round, status) VALUES (?, ?, ?, 'waiting');")
          .bind(t.id, photoId, t.current_round),
      );
    } else if (status === 'removed') {
      statements.push(
        db
          .prepare("UPDATE matchup_entries SET status = 'waiting', round = ?, decided_at = NULL WHERE tournament_id = ? AND photo_id = ?;")
          .bind(t.current_round, t.id, photoId),
      );
    }
  }
  for (const [photoId, status] of existing) {
    if (!eligible.has(photoId) && (status === 'waiting' || status === 'playing' || status === 'advanced')) {
      statements.push(
        db
          .prepare("UPDATE matchup_entries SET status = 'removed', decided_at = ? WHERE tournament_id = ? AND photo_id = ?;")
          .bind(nowIso(), t.id, photoId),
      );
    }
  }
  if (statements.length) await db.batch(statements);
}

/**
 * Pick the next two photos from the bracket. Returns null when fewer than two photos are
 * eligible. Call after finalizeClosedMatchups so last week's winners are already recorded.
 */
export async function selectBracketPair(
  db: any,
  eligibleIds: number[],
  rng: Rng = Math.random,
): Promise<BracketPick | null> {
  const unique = [...new Set(eligibleIds.filter((id) => Number.isFinite(id) && id > 0))];
  if (unique.length < 2) return null;

  let t = (await activeTournament(db)) ?? (await startTournament(db, unique));

  for (let guard = 0; guard < 50; guard += 1) {
    await syncEntries(db, t, unique);
    // No matchup is in play when a new pair is chosen, so anything left "playing" returns to
    // the pool (for example a pair replaced after a photo was retired).
    await db
      .prepare("UPDATE matchup_entries SET status = 'waiting' WHERE tournament_id = ? AND status = 'playing';")
      .bind(t.id)
      .run();

    const waitingRows = await db
      .prepare("SELECT photo_id FROM matchup_entries WHERE tournament_id = ? AND status = 'waiting' AND round = ?;")
      .bind(t.id, t.current_round)
      .all();
    const waiting: number[] = (waitingRows?.results ?? []).map((r: any) => Number(r.photo_id));

    if (waiting.length >= 2) {
      const [a, b] = shuffle([...waiting], rng);
      await db.batch([
        db
          .prepare("UPDATE matchup_entries SET status = 'playing' WHERE tournament_id = ? AND photo_id IN (?, ?);")
          .bind(t.id, a, b),
      ]);
      return { photoAId: a, photoBId: b, tournamentId: t.id, round: t.current_round };
    }

    if (waiting.length === 1) {
      // The odd photo out gets a bye and moves on.
      await db
        .prepare("UPDATE matchup_entries SET status = 'advanced', decided_at = ? WHERE tournament_id = ? AND photo_id = ?;")
        .bind(nowIso(), t.id, waiting[0])
        .run();
      continue;
    }

    // Nothing left to play this round.
    const doneRows = await db
      .prepare(
        "SELECT photo_id, status FROM matchup_entries WHERE tournament_id = ? AND round = ? AND status IN ('advanced', 'eliminated');",
      )
      .bind(t.id, t.current_round)
      .all();
    const done = doneRows?.results ?? [];
    const survivors: number[] = done.filter((r: any) => r.status === 'advanced').map((r: any) => Number(r.photo_id));

    if (survivors.length <= 1 || survivors.length === done.length) {
      // One photo left, or a round where every game tied: the survivors are the champions.
      await completeTournament(db, t.id, survivors);
      t = await startTournament(db, unique);
      continue;
    }

    await db.batch([
      db
        .prepare("UPDATE matchup_entries SET status = 'waiting', round = ? WHERE tournament_id = ? AND status = 'advanced';")
        .bind(t.current_round + 1, t.id),
      db
        .prepare('UPDATE matchup_tournaments SET current_round = ? WHERE id = ?;')
        .bind(t.current_round + 1, t.id),
    ]);
    t = { id: t.id, current_round: t.current_round + 1 };
  }

  return null;
}

/** Tie the week's matchup row to the bracket so its result can be recorded when it closes. */
export async function attachMatchupToBracket(db: any, matchupId: number, pick: BracketPick): Promise<void> {
  await db.batch([
    db
      .prepare('UPDATE weekly_matchups SET tournament_id = ?, round = ? WHERE id = ?;')
      .bind(pick.tournamentId, pick.round, matchupId),
    db
      .prepare('UPDATE matchup_entries SET matchup_id = ? WHERE tournament_id = ? AND photo_id IN (?, ?);')
      .bind(matchupId, pick.tournamentId, pick.photoAId, pick.photoBId),
  ]);
}

/**
 * Note the winner of every closed matchup that has none yet: count the week's votes, record
 * the result, advance the winner and eliminate the loser. A tie advances both. Safe to run
 * repeatedly; a matchup is finalized once.
 */
export async function finalizeClosedMatchups(db: any): Promise<number> {
  const rows = await db
    .prepare(
      `SELECT id, week_start, photo_a_id, photo_b_id, tournament_id, round
       FROM weekly_matchups
       WHERE status = 'closed' AND tournament_id IS NOT NULL AND finalized_at IS NULL
       ORDER BY week_start;`,
    )
    .all();

  let finalized = 0;
  for (const m of rows?.results ?? []) {
    const totals = await db
      .prepare(
        "SELECT SUM(CASE WHEN choice = 'a' THEN 1 ELSE 0 END) AS a, SUM(CASE WHEN choice = 'b' THEN 1 ELSE 0 END) AS b FROM weekly_votes WHERE week_start = ?;",
      )
      .bind(String(m.week_start))
      .first();
    const votesA = Number(totals?.a || 0);
    const votesB = Number(totals?.b || 0);
    const outcome = votesA === votesB ? 'tie' : votesA > votesB ? 'a' : 'b';

    const photoA = Number(m.photo_a_id);
    const photoB = Number(m.photo_b_id);
    const tournamentId = Number(m.tournament_id);
    const round = Number(m.round || 1);
    const decidedAt = nowIso();
    const aStatus = outcome === 'b' ? 'eliminated' : 'advanced';
    const bStatus = outcome === 'a' ? 'eliminated' : 'advanced';

    const statements: any[] = [
      db
        .prepare(
          'UPDATE weekly_matchups SET votes_a = ?, votes_b = ?, outcome = ?, finalized_at = ? WHERE id = ? AND finalized_at IS NULL;',
        )
        .bind(votesA, votesB, outcome, decidedAt, Number(m.id)),
    ];
    for (const [photoId, status] of [
      [photoA, aStatus],
      [photoB, bStatus],
    ] as Array<[number, string]>) {
      // A photo swapped in by an admin repair may have no entry yet; make sure one exists.
      statements.push(
        db
          .prepare("INSERT OR IGNORE INTO matchup_entries (tournament_id, photo_id, round, status) VALUES (?, ?, ?, 'waiting');")
          .bind(tournamentId, photoId, round),
        db
          .prepare(
            "UPDATE matchup_entries SET status = ?, decided_at = ?, matchup_id = ? WHERE tournament_id = ? AND photo_id = ? AND status IN ('playing', 'waiting');",
          )
          .bind(status, decidedAt, Number(m.id), tournamentId, photoId),
      );
    }
    await db.batch(statements);
    finalized += 1;
  }
  return finalized;
}
