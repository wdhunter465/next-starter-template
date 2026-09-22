#!/usr/bin/env node
// #4183 follow-up: ingests Lou Gehrig's full career game log, per-game box
// score lines, and AL standings-as-of-date snapshots from Retrosheet's
// public CSV master files, for the Club Home random box score / AL
// standings margins feature.
//
// Retrosheet publishes seven master CSV files (gameinfo, teamstats,
// batting, pitching, fielding, plays, allplayers) covering every game
// 1898-2025 as a single zip on https://www.retrosheet.org/downloads/
// csvdownloads.html. This script discovers that zip's real URL and each
// CSV's real column names AT RUNTIME (by fetching the page / reading each
// file's header row) rather than hardcoding guesses, since the exact
// filename and column order are not independently verifiable from this
// environment ahead of time -- fail fast with a clear error if a page or
// column Retrosheet changed the name of can't be found, rather than
// silently ingesting the wrong data.
//
// Usage:
//   node scripts/ingest-gehrig-retrosheet-data.mjs --print
//   node scripts/ingest-gehrig-retrosheet-data.mjs --apply --remote
//   node scripts/ingest-gehrig-retrosheet-data.mjs --apply --local

import { mkdtempSync, rmSync, existsSync, readdirSync, createWriteStream, createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_AGENT = 'LGFC-ClubHome-Retrosheet-Ingest/1.0 (lougehrigfanclub.com; contact via site)';

const GEHRIG_PLAYER_ID = 'gehrl101';
const GEHRIG_TEAM = 'NYA';
const CAREER_START = '1923-06-15';
const CAREER_END = '1939-04-30';
// Fixed for Gehrig's entire career -- no AL expansion/relocation 1923-1939.
const AL_TEAMS = new Set(['NYA', 'BOS', 'PHA', 'WS1', 'CLE', 'DET', 'CHA', 'SLA']);

function seasonYearOf(dateIso) {
  return Number(dateIso.slice(0, 4));
}

function inCareerRange(dateIso) {
  return dateIso >= CAREER_START && dateIso <= CAREER_END;
}

// The CSV downloads page lists many zips. Matching /all|main|full/ incorrectly
// prefers allplayers.zip (player bios, no gameinfo.csv). The full seven-file
// bundle is advertised as "Main CSV Download" and ships as csvdownloads.zip.
export function resolveMasterCsvZipUrl(hrefs, pageUrl) {
  if (!hrefs.length) {
    throw new Error(
      `Could not find a .zip link on ${pageUrl} -- Retrosheet may have restructured this page. Inspect it manually and update resolveMasterCsvZipUrl().`,
    );
  }
  const urls = hrefs.map((h) => new URL(h, pageUrl).toString());
  const main = urls.find((u) => /\/csvdownloads\.zip$/i.test(u));
  if (main) return main;
  throw new Error(
    `Could not find csvdownloads.zip on ${pageUrl}. Zips found: ${urls.join(', ')}. Update resolveMasterCsvZipUrl() if Retrosheet renamed the main bundle.`,
  );
}

async function discoverCsvZipUrl() {
  const pageUrl = 'https://www.retrosheet.org/downloads/csvdownloads.html';
  const res = await fetch(pageUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Fetching ${pageUrl} -> HTTP ${res.status}`);
  const html = await res.text();
  const hrefs = [...html.matchAll(/href\s*=\s*"([^"]+\.zip)"/gi)].map((m) => m[1]);
  return resolveMasterCsvZipUrl(hrefs, pageUrl);
}

function downloadFile(url, destPath) {
  const result = spawnSync('curl', ['-sS', '-L', '--fail', '-A', USER_AGENT, '-o', destPath, url], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`curl failed downloading ${url} (exit ${result.status})`);
}

function unzip(zipPath, destDir) {
  const result = spawnSync('unzip', ['-o', '-q', zipPath, '-d', destDir], { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`unzip failed for ${zipPath} (exit ${result.status})`);
}

function findFileRecursive(rootDir, filename) {
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.name.toLowerCase() === filename.toLowerCase()) return full;
    }
  }
  return null;
}

// Minimal RFC4180-ish CSV parser: handles quoted fields containing commas/
// quotes/newlines. Retrosheet's CSVs are machine-generated and well-formed.
// batting.csv in the main bundle exceeds Node's max string length, so ingest
// streams the file instead of readFileSync.
export function createCsvRowParser(onRow) {
  let row = [];
  let field = '';
  let inQuotes = false;
  let hold = '';

  function emitRow() {
    if (row.length > 1 || row[0] !== '') onRow(row);
    row = [];
    field = '';
  }

  function feed(chunk) {
    const text = hold + chunk;
    hold = '';
    for (let i = 0; i < text.length; i += 1) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (i + 1 >= text.length) {
            hold = '"';
            return;
          }
          if (text[i + 1] === '"') {
            field += '"';
            i += 1;
          } else {
            inQuotes = false;
          }
        } else {
          field += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        row.push(field);
        field = '';
      } else if (c === '\n' || c === '\r') {
        if (c === '\r') {
          if (i + 1 >= text.length) {
            hold = '\r';
            return;
          }
          if (text[i + 1] === '\n') i += 1;
        }
        row.push(field);
        field = '';
        emitRow();
      } else {
        field += c;
      }
    }
  }

  function end() {
    if (hold === '\r') {
      row.push(field);
      field = '';
      emitRow();
      hold = '';
    } else if (hold === '"') {
      inQuotes = false;
      hold = '';
    }
    if (inQuotes) {
      throw new Error('CSV ended inside a quoted field');
    }
    if (field !== '' || row.length) {
      row.push(field);
      emitRow();
    }
  }

  return { feed, end };
}

export function parseCsv(text) {
  const rows = [];
  const parser = createCsvRowParser((row) => rows.push(row));
  parser.feed(text);
  parser.end();
  if (!rows.length) return { header: [], records: [] };
  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((r) => {
    const rec = {};
    header.forEach((h, idx) => {
      rec[h] = r[idx] ?? '';
    });
    return rec;
  });
  return { header, records };
}

async function streamCsvFile(filePath, onRecord) {
  let header = null;
  let count = 0;
  const parser = createCsvRowParser((row) => {
    if (!header) {
      header = row.map((h) => h.trim());
      return;
    }
    const rec = {};
    header.forEach((h, idx) => {
      rec[h] = row[idx] ?? '';
    });
    count += 1;
    onRecord(rec, header);
  });
  const stream = createReadStream(filePath, { encoding: 'utf8', highWaterMark: 1024 * 1024 });
  for await (const chunk of stream) {
    parser.feed(chunk);
  }
  parser.end();
  if (!header) throw new Error(`No header row in ${filePath}`);
  return { header, count };
}

function csvPath(extractedDir, filename) {
  const filePath = findFileRecursive(extractedDir, filename);
  if (!filePath) throw new Error(`${filename} not found anywhere under ${extractedDir} after unzip.`);
  return filePath;
}

async function loadCsv(extractedDir, filename) {
  const filePath = csvPath(extractedDir, filename);
  const records = [];
  const { header, count } = await streamCsvFile(filePath, (rec) => {
    records.push(rec);
  });
  console.log(`Loaded ${filename}: ${count} rows, columns: ${header.join(', ')}`);
  return { header, records };
}

// Column-name lookup is case-insensitive and tries a few plausible aliases,
// since the exact Retrosheet header spelling wasn't independently
// verifiable from this environment. Throws with the real header list if
// none of the candidates match, so a wrong guess fails loudly in CI logs
// instead of silently reading undefined.
export function resolveColumn(header, candidates, context) {
  const lower = header.map((h) => h.toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate.toLowerCase());
    if (idx >= 0) return header[idx];
  }
  throw new Error(
    `${context}: none of [${candidates.join(', ')}] found in header [${header.join(', ')}]. Retrosheet's column naming differs from what this script expected -- update resolveColumn() call sites for this file.`,
  );
}

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInt(value) {
  if (value === null || value === undefined || value === '') return 'NULL';
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : 'NULL';
}

// Streams SQL statements straight to disk instead of buffering all of them
// (tens of thousands, across 2,164 games) in memory before a single final
// join+write.
function createStatementWriter(filePath) {
  const stream = createWriteStream(filePath, { encoding: 'utf8' });
  let streamError = null;
  stream.on('error', (err) => {
    streamError = streamError ?? err;
  });
  let count = 0;
  const preview = [];
  return {
    // Awaited by callers -- if stream.write() reports its internal buffer is
    // over highWaterMark, wait for 'drain' before returning instead of
    // letting the buffer grow unbounded, which would defeat the point of
    // streaming instead of building one big in-memory array.
    async write(statement) {
      if (streamError) throw streamError;
      count += 1;
      if (preview.length < 5) preview.push(statement);
      const withinBuffer = stream.write(`${statement}\n`);
      if (!withinBuffer && !streamError) {
        await new Promise((resolve, reject) => {
          stream.once('drain', resolve);
          stream.once('error', reject);
        });
      }
    },
    get count() {
      return count;
    },
    get preview() {
      return preview;
    },
    close() {
      // Writable's end() callback is a 'finish' listener, not an (err) =>
      // callback -- it never receives an error argument. Track stream
      // errors via the 'error' listener above instead of trusting end()'s
      // callback signature to carry one.
      if (streamError) return Promise.reject(streamError);
      return new Promise((resolve, reject) => {
        stream.once('error', reject);
        stream.end(() => resolve());
      });
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--apply') ? 'apply' : 'print';
  const isRemote = args.includes('--remote');

  const tmpRoot = mkdtempSync(path.join(os.tmpdir(), 'retrosheet-'));
  const zipPath = path.join(tmpRoot, 'retrosheet-csv.zip');
  const extractDir = path.join(tmpRoot, 'extracted');

  try {
    console.log('Discovering Retrosheet CSV master-file download URL...');
    const zipUrl = await discoverCsvZipUrl();
    console.log(`Resolved zip URL: ${zipUrl}`);

    console.log('Downloading (this is a large file, may take a while)...');
    downloadFile(zipUrl, zipPath);

    console.log('Unzipping...');
    unzip(zipPath, extractDir);

    const gameinfo = await loadCsv(extractDir, 'gameinfo.csv');
    const battingPath = csvPath(extractDir, 'batting.csv');
    const pitchingPath = csvPath(extractDir, 'pitching.csv');

    const giCols = {
      gid: resolveColumn(gameinfo.header, ['gid', 'gameid', 'game_id'], 'gameinfo.csv'),
      visteam: resolveColumn(gameinfo.header, ['visteam', 'vis_team', 'away_team'], 'gameinfo.csv'),
      hometeam: resolveColumn(gameinfo.header, ['hometeam', 'home_team'], 'gameinfo.csv'),
      date: resolveColumn(gameinfo.header, ['date'], 'gameinfo.csv'),
      site: resolveColumn(gameinfo.header, ['site'], 'gameinfo.csv'),
      number: resolveColumn(gameinfo.header, ['number', 'game_number', 'gamenum'], 'gameinfo.csv'),
      daynight: resolveColumn(gameinfo.header, ['daynight', 'day_night'], 'gameinfo.csv'),
      visscore: resolveColumn(
        gameinfo.header,
        ['visscore', 'vis_score', 'awayscore', 'vruns', 'visruns', 'vis_runs', 'v_score'],
        'gameinfo.csv',
      ),
      homescore: resolveColumn(
        gameinfo.header,
        ['homescore', 'home_score', 'hruns', 'h_score'],
        'gameinfo.csv',
      ),
    };
    const battingCols = {
      gid: null,
      team: null,
      playerid: null,
      battingorder: null,
    };
    const pitchingCols = {
      gid: null,
      team: null,
      playerid: null,
    };

    const gameinfoByGid = new Map(gameinfo.records.map((r) => [r[giCols.gid], r]));

    console.log('Streaming batting.csv for Gehrig game ids...');
    const gehrigGidsFromBatting = new Set();
    const battingPass1 = await streamCsvFile(battingPath, (rec, header) => {
      if (!battingCols.gid) {
        battingCols.gid = resolveColumn(header, ['gid', 'gameid', 'game_id'], 'batting.csv');
        battingCols.team = resolveColumn(header, ['team'], 'batting.csv');
        battingCols.playerid = resolveColumn(header, ['playerid', 'player_id', 'id'], 'batting.csv');
        battingCols.battingorder = resolveColumn(header, ['battingorder', 'batting_order', 'bat_order', 'batting'], 'batting.csv');
      }
      if (rec[battingCols.playerid] === GEHRIG_PLAYER_ID && rec[battingCols.team] === GEHRIG_TEAM) {
        gehrigGidsFromBatting.add(rec[battingCols.gid]);
      }
    });
    console.log(`Scanned batting.csv: ${battingPass1.count} rows, columns: ${battingPass1.header.join(', ')}`);

    const gehrigGameIds = [...gehrigGidsFromBatting].filter((gid) => {
      const gi = gameinfoByGid.get(gid);
      return gi && inCareerRange(gi[giCols.date]);
    });
    const gehrigGameIdSet = new Set(gehrigGameIds);

    console.log(`Found ${gehrigGameIds.length} Gehrig games in range ${CAREER_START}..${CAREER_END} (expect 2,164).`);
    if (gehrigGameIds.length < 2000 || gehrigGameIds.length > 2300) {
      throw new Error(
        `Gehrig game count (${gehrigGameIds.length}) is far from the documented 2,164 -- refusing to proceed. Check GEHRIG_PLAYER_ID/GEHRIG_TEAM/date range and the batting.csv column resolution above.`,
      );
    }

    console.log('Streaming batting.csv for box-score lines on those games...');
    const battingByGid = new Map();
    await streamCsvFile(battingPath, (rec) => {
      const gid = rec[battingCols.gid];
      if (!gehrigGameIdSet.has(gid)) return;
      const bucket = battingByGid.get(gid);
      if (bucket) bucket.push(rec);
      else battingByGid.set(gid, [rec]);
    });

    console.log('Streaming pitching.csv for those games...');
    const pitchingByGid = new Map();
    const pitchingScan = await streamCsvFile(pitchingPath, (rec, header) => {
      if (!pitchingCols.gid) {
        pitchingCols.gid = resolveColumn(header, ['gid', 'gameid', 'game_id'], 'pitching.csv');
        pitchingCols.team = resolveColumn(header, ['team'], 'pitching.csv');
        pitchingCols.playerid = resolveColumn(header, ['playerid', 'player_id', 'id'], 'pitching.csv');
      }
      const gid = rec[pitchingCols.gid];
      if (!gehrigGameIdSet.has(gid)) return;
      const bucket = pitchingByGid.get(gid);
      if (bucket) bucket.push(rec);
      else pitchingByGid.set(gid, [rec]);
    });
    console.log(`Scanned pitching.csv: ${pitchingScan.count} rows, columns: ${pitchingScan.header.join(', ')}`);

    // 2. AL standings: walk every AL-vs-AL game across the career span in
    //    date order once per season, building a cumulative W/L snapshot
    //    after each date, so a per-Gehrig-game lookup is O(1) afterward.
    const alGames = gameinfo.records.filter(
      (r) =>
        AL_TEAMS.has(r[giCols.visteam]) &&
        AL_TEAMS.has(r[giCols.hometeam]) &&
        inCareerRange(r[giCols.date]) &&
        r[giCols.visscore] !== '' &&
        r[giCols.homescore] !== '',
    );
    alGames.sort((a, b) => (a[giCols.date] < b[giCols.date] ? -1 : a[giCols.date] > b[giCols.date] ? 1 : 0));

    const standingsByYearDate = new Map(); // year -> date -> {team: {w,l,t}}
    const running = new Map(); // `${year}:${team}` -> {w,l,t}
    for (const g of alGames) {
      const year = seasonYearOf(g[giCols.date]);
      const vis = g[giCols.visteam];
      const home = g[giCols.hometeam];
      const visScore = Number(g[giCols.visscore]);
      const homeScore = Number(g[giCols.homescore]);
      for (const team of [vis, home]) {
        const key = `${year}:${team}`;
        if (!running.has(key)) running.set(key, { w: 0, l: 0, t: 0 });
      }
      if (visScore === homeScore) {
        running.get(`${year}:${vis}`).t += 1;
        running.get(`${year}:${home}`).t += 1;
      } else if (visScore > homeScore) {
        running.get(`${year}:${vis}`).w += 1;
        running.get(`${year}:${home}`).l += 1;
      } else {
        running.get(`${year}:${home}`).w += 1;
        running.get(`${year}:${vis}`).l += 1;
      }

      if (!standingsByYearDate.has(year)) standingsByYearDate.set(year, new Map());
      const snapshot = {};
      for (const team of AL_TEAMS) {
        const rec = running.get(`${year}:${team}`) ?? { w: 0, l: 0, t: 0 };
        snapshot[team] = { ...rec };
      }
      standingsByYearDate.get(year).set(g[giCols.date], snapshot);
    }

    function standingsAsOf(year, date) {
      const byDate = standingsByYearDate.get(year);
      if (!byDate) return null;
      if (byDate.has(date)) return byDate.get(date);
      // No AL game recorded exactly on this date (rare, e.g. a Gehrig
      // exhibition entry) -- fall back to the latest snapshot at or before it.
      let best = null;
      let bestDate = null;
      for (const [d, snap] of byDate) {
        if (d <= date && (!bestDate || d > bestDate)) {
          best = snap;
          bestDate = d;
        }
      }
      return best;
    }

    // 3. Build SQL, streamed straight to disk rather than buffered in memory.
    const now = new Date().toISOString().replace('Z', '000Z').slice(0, 24);
    const sqlFile = path.join(tmpRoot, 'gehrig-retrosheet-ingest.sql');
    const writer = createStatementWriter(sqlFile);

    for (const gid of gehrigGameIds) {
      const gi = gameinfoByGid.get(gid);
      const date = gi[giCols.date];
      const year = seasonYearOf(date);
      const opponent = gi[giCols.visteam] === GEHRIG_TEAM ? gi[giCols.hometeam] : gi[giCols.visteam];

      await writer.write(
        `INSERT INTO retrosheet_gehrig_games (game_id, game_date, season_year, game_number, vis_team, home_team, vis_score, home_score, site, day_night, gehrig_team, gehrig_opponent, created_at, source) VALUES (${sqlString(gid)}, ${sqlString(date)}, ${sqlInt(year)}, ${sqlInt(gi[giCols.number] || 0)}, ${sqlString(gi[giCols.visteam])}, ${sqlString(gi[giCols.hometeam])}, ${sqlInt(gi[giCols.visscore])}, ${sqlInt(gi[giCols.homescore])}, ${sqlString(gi[giCols.site] || null)}, ${sqlString(gi[giCols.daynight] || null)}, ${sqlString(GEHRIG_TEAM)}, ${sqlString(opponent)}, ${sqlString(now)}, 'retrosheet') ON CONFLICT(game_id) DO UPDATE SET game_date = excluded.game_date, vis_score = excluded.vis_score, home_score = excluded.home_score;`,
      );

      // (game_id, team, stat_type, player_id) is a natural key -- a player has
      // at most one batting line and one pitching line per game per team --
      // enforced by migration 0075's unique index. Upserting on it makes a
      // re-run of --apply idempotent instead of duplicating every line.
      for (const r of battingByGid.get(gid) ?? []) {
        const line = { ...r };
        delete line[battingCols.gid];
        await writer.write(
          `INSERT INTO retrosheet_box_score_lines (game_id, team, stat_type, player_id, batting_order, line_json, created_at) VALUES (${sqlString(gid)}, ${sqlString(r[battingCols.team])}, 'batting', ${sqlString(r[battingCols.playerid])}, ${sqlInt(r[battingCols.battingorder])}, ${sqlString(JSON.stringify(line))}, ${sqlString(now)}) ON CONFLICT(game_id, team, stat_type, player_id) DO UPDATE SET batting_order = excluded.batting_order, line_json = excluded.line_json, created_at = excluded.created_at;`,
        );
      }
      for (const r of pitchingByGid.get(gid) ?? []) {
        const line = { ...r };
        delete line[pitchingCols.gid];
        await writer.write(
          `INSERT INTO retrosheet_box_score_lines (game_id, team, stat_type, player_id, batting_order, line_json, created_at) VALUES (${sqlString(gid)}, ${sqlString(r[pitchingCols.team])}, 'pitching', ${sqlString(r[pitchingCols.playerid])}, NULL, ${sqlString(JSON.stringify(line))}, ${sqlString(now)}) ON CONFLICT(game_id, team, stat_type, player_id) DO UPDATE SET line_json = excluded.line_json, created_at = excluded.created_at;`,
        );
      }

      const snapshot = standingsAsOf(year, date);
      if (snapshot) {
        const ranked = [...AL_TEAMS]
          .map((team) => {
            const rec = snapshot[team] ?? { w: 0, l: 0, t: 0 };
            const winPct = rec.w + rec.l > 0 ? rec.w / (rec.w + rec.l) : 0;
            return { team, ...rec, winPct };
          })
          .sort((a, b) => b.winPct - a.winPct);
        const leader = ranked[0];
        for (const [idx, row] of ranked.entries()) {
          const gamesBack = ((leader.w - row.w + (row.l - leader.l)) / 2).toFixed(1);
          await writer.write(
            `INSERT INTO retrosheet_al_standings_snapshots (game_id, team, wins, losses, ties, win_pct, games_back, league_rank, created_at) VALUES (${sqlString(gid)}, ${sqlString(row.team)}, ${sqlInt(row.w)}, ${sqlInt(row.l)}, ${sqlInt(row.t)}, ${row.winPct.toFixed(4)}, ${gamesBack}, ${idx + 1}, ${sqlString(now)}) ON CONFLICT(game_id, team) DO UPDATE SET wins = excluded.wins, losses = excluded.losses, ties = excluded.ties, win_pct = excluded.win_pct, games_back = excluded.games_back, league_rank = excluded.league_rank;`,
          );
        }
      } else {
        console.warn(`No AL standings snapshot available for ${gid} (${date}) -- skipping standings rows for this game.`);
      }
    }

    await writer.close();
    console.log(`Built ${writer.count} SQL statements for ${gehrigGameIds.length} games.`);

    if (mode === 'print') {
      console.log('--print: not writing to D1. Re-run with --apply --remote/--local.');
      console.log(writer.preview.join('\n'));
      console.log(`... (${writer.count - writer.preview.length} more statements)`);
      return;
    }

    const d1Args = isRemote
      ? ['wrangler', 'd1', 'execute', 'lgfc_lite', '--remote', '--yes']
      : ['wrangler', 'd1', 'execute', 'DB', '--local', '--env', 'preview'];
    const result = spawnSync('npx', [...d1Args, '--file', sqlFile], {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..'),
    });
    if (result.status !== 0) throw new Error(`wrangler d1 execute exited ${result.status}`);
  } finally {
    try {
      if (existsSync(tmpRoot)) rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err) => {
    console.error(err?.stack || err);
    process.exit(1);
  });
}
