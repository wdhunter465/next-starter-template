// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  buildRelatedInYearSql,
  buildUpsertStatements,
  displayName,
  groupPeople,
  parseRosterFile,
  relationForTeam,
} from '../scripts/content-pipeline/gehrig-related-people-lib.mjs';
import { parseArgs } from '../scripts/content-pipeline/load-gehrig-related-people.mjs';

const BOS1935 = ['dahlb101,Dahlgren,Babe,R,R,BOS,1B', 'cronj102,Cronin,Joe,R,R,BOS,SS', 'bad line', ',NoId,X,R,R,BOS,P'].join('\n');
const NYA1937 = ['dahlb101,Dahlgren,Babe,R,R,NYA,PH', 'gehrl101,Gehrig,Lou,L,L,NYA,1B', 'dimam102,DiMaggio,Joe,R,R,NYA,CF'].join('\r\n');
const NYA1938 = 'dahlb101,Dahlgren,Babe,R,R,NYA,1B';
const STL1935 = 'dean-101,Dean,Dizzy,R,R,SLN,P';

function migratedDb() {
  const db = new DatabaseSync(':memory:');
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  return db;
}

function allRows() {
  return [
    ...parseRosterFile(BOS1935, 1935),
    ...parseRosterFile(NYA1937, 1937),
    ...parseRosterFile(NYA1938, 1938),
    ...parseRosterFile('cronj102,Cronin,Joe,R,R,WS1,SS', 1934),
    ...parseRosterFile('mizej101,Mize,Johnny,L,R,SLN,1B', 1936),
  ];
}

describe('Retrosheet roster parsing (#5087)', () => {
  it('reads id, name, team and position, and skips lines without a valid id', () => {
    const rows = parseRosterFile(BOS1935, 1935);
    expect(rows).toEqual([
      { retrosheetId: 'dahlb101', displayName: 'Babe Dahlgren', team: 'BOS', position: '1B', season: 1935, relation: 'opponent' },
      { retrosheetId: 'cronj102', displayName: 'Joe Cronin', team: 'BOS', position: 'SS', season: 1935, relation: 'opponent' },
    ]);
    expect(parseRosterFile(STL1935, 1935)).toEqual([]);
    expect(parseRosterFile(NYA1937, 1937)).toHaveLength(3);
    expect(displayName('Ruth', 'Babe')).toBe('Babe Ruth');
  });

  it('classifies the team: Yankees teammate, other American League opponent, National League other_league', () => {
    expect(relationForTeam('NYA')).toBe('teammate');
    for (const team of ['BOS', 'PHA', 'WS1', 'CLE', 'DET', 'CHA', 'SLA']) expect(relationForTeam(team)).toBe('opponent');
    for (const team of ['SLN', 'BRO', 'NY1', 'CHN']) expect(relationForTeam(team)).toBe('other_league');
  });
});

describe('grouping players into the reference list (#5087)', () => {
  it('gives Dahlgren the opponent years 1935 and the teammate years 1937 to 1938, and leaves Gehrig out', () => {
    const people = groupPeople(allRows());
    const dahlgren = people.find((p) => p.retrosheetId === 'dahlb101');
    expect(dahlgren).toMatchObject({ displayName: 'Babe Dahlgren', relation: 'teammate', yearFrom: 1935, yearTo: 1938 });
    expect(dahlgren?.seasons.map((s: { season: number; team: string; relation: string }) => `${s.season}:${s.team}:${s.relation}`)).toEqual(['1935:BOS:opponent', '1937:NYA:teammate', '1938:NYA:teammate']);
    expect(people.find((p) => p.retrosheetId === 'gehrl101')).toBeUndefined();
    expect(people.find((p) => p.retrosheetId === 'mizej101')).toMatchObject({ relation: 'other_league' });
  });
});

describe('the SQL and migration 0092 (#5087)', () => {
  it('loads the list, is idempotent, and keeps a recorded permission status when the loader runs again', () => {
    const db = migratedDb();
    const statements = buildUpsertStatements(groupPeople(allRows()));
    for (const sql of statements) db.exec(sql);
    const counts = () => ({
      people: (db.prepare('SELECT COUNT(*) n FROM gehrig_related_people').get() as { n: number }).n,
      seasons: (db.prepare('SELECT COUNT(*) n FROM gehrig_related_person_seasons').get() as { n: number }).n,
    });
    expect(counts()).toEqual({ people: 4, seasons: 7 });

    db.prepare("UPDATE gehrig_related_people SET permission_status = 'denied', permission_note = 'test denial' WHERE retrosheet_id = 'dahlb101'").run();
    for (const sql of statements) db.exec(sql);
    expect(counts()).toEqual({ people: 4, seasons: 7 });
    expect(db.prepare("SELECT permission_status FROM gehrig_related_people WHERE retrosheet_id = 'dahlb101'").get()).toEqual({ permission_status: 'denied' });
  });

  it('answers "related in this year" with the season relation and drops a person who has denied the Fan Club', () => {
    const db = migratedDb();
    for (const sql of buildUpsertStatements(groupPeople(allRows()))) db.exec(sql);
    const ask = (name: string, season: number) => db.prepare(buildRelatedInYearSql()).all(name, season);
    expect(ask('Babe Dahlgren', 1935)).toEqual([expect.objectContaining({ team: 'BOS', relation: 'opponent' })]);
    expect(ask('Babe Dahlgren', 1938)).toEqual([expect.objectContaining({ team: 'NYA', relation: 'teammate' })]);
    expect(ask('Babe Dahlgren', 1941)).toEqual([]);
    db.prepare("UPDATE gehrig_related_people SET permission_status = 'denied' WHERE retrosheet_id = 'dahlb101'").run();
    expect(ask('Babe Dahlgren', 1938)).toEqual([]);
  });

  it('does not overwrite rows from other sources and enforces the checks', () => {
    const db = migratedDb();
    db.prepare("INSERT INTO gehrig_related_people (retrosheet_id, display_name, relation, source) VALUES ('dahlb101', 'Hand Entered', 'friend', 'manual')").run();
    for (const sql of buildUpsertStatements(groupPeople(allRows()))) db.exec(sql);
    expect(db.prepare("SELECT display_name, relation FROM gehrig_related_people WHERE retrosheet_id = 'dahlb101'").get()).toEqual({ display_name: 'Hand Entered', relation: 'friend' });
    expect(() => db.prepare("INSERT INTO gehrig_related_people (display_name, relation, source) VALUES ('X', 'cousin', 'manual')").run()).toThrow();
    expect(() => db.prepare("INSERT INTO gehrig_related_people (display_name, source, permission_status) VALUES ('X', 'manual', 'maybe')").run()).toThrow();
    expect(() => db.prepare("INSERT INTO gehrig_related_people (display_name, source, year_from, year_to) VALUES ('X', 'manual', 1939, 1923)").run()).toThrow();
  });
});

describe('loader arguments (#5087)', () => {
  it('defaults to a summary of 1923 to 1939 and refuses an apply without a target', () => {
    expect(parseArgs([])).toMatchObject({ from: 1923, to: 1939, apply: false });
    expect(parseArgs(['--from', '1935', '--to', '1937'])).toMatchObject({ from: 1935, to: 1937 });
    expect(() => parseArgs(['--apply'])).toThrow(/--remote or --local/);
    expect(() => parseArgs(['--from', '1920'])).toThrow(/between 1923 and 1939/);
    expect(() => parseArgs(['--bogus'])).toThrow(/Unknown argument/);
  });
});
