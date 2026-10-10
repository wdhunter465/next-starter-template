// @vitest-environment node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

// #4466 (gap row 4): schema and migration validation at PR time.
//
// d1-migrations only runs on push to main, so a migration that does not apply, or one numbered
// carelessly, was first found after merge. This applies every migration, in the order D1 applies
// them (sorted filename), to a scratch in-memory SQLite database on every PR, and checks the
// numbering rules. D1 is SQLite, so a statement that fails here fails there.
//
// The four duplicate prefixes below predate this check. D1 tracks migrations by full filename,
// so they apply, but a new duplicate would make the order depend on the suffix, so only these
// exist and any other fails.

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');
const KNOWN_DUPLICATE_PREFIXES = ['0020', '0028', '0044', '0045'];
const NAME = /^(\d{4})_[A-Za-z0-9_.-]+\.sql$/;

function listMigrations(dir: string): string[] {
	return fs
		.readdirSync(dir)
		.filter((f) => f.endsWith('.sql'))
		.sort();
}

function namingProblems(files: string[], knownDuplicates = KNOWN_DUPLICATE_PREFIXES): string[] {
	const problems: string[] = [];
	const byPrefix = new Map<string, string[]>();
	for (const file of files) {
		const match = NAME.exec(file);
		if (!match) {
			problems.push(`bad name: ${file}`);
			continue;
		}
		byPrefix.set(match[1], [...(byPrefix.get(match[1]) ?? []), file]);
	}
	for (const [prefix, names] of byPrefix) {
		if (names.length > 1 && !knownDuplicates.includes(prefix)) problems.push(`new duplicate prefix ${prefix}: ${names.join(', ')}`);
	}
	const numbers = [...byPrefix.keys()].map(Number).sort((a, b) => a - b);
	for (let i = 0; i < numbers.length; i += 1) {
		const expected = numbers[0] + i;
		if (numbers[i] !== expected) {
			problems.push(`numbering gap: expected ${String(expected).padStart(4, '0')} but found ${String(numbers[i]).padStart(4, '0')}`);
			break;
		}
	}
	return problems;
}

function applyAll(dir: string): { db: DatabaseSync; failures: string[] } {
	const db = new DatabaseSync(':memory:');
	const failures: string[] = [];
	for (const file of listMigrations(dir)) {
		const sql = fs.readFileSync(path.join(dir, file), 'utf8');
		if (sql.trim() === '') {
			failures.push(`${file}: empty`);
			continue;
		}
		try {
			db.exec(sql);
		} catch (err) {
			failures.push(`${file}: ${(err as Error).message}`);
		}
	}
	return { db, failures };
}

describe('migrations against a scratch database (#4466 row 4)', () => {
	it('finds the repository migrations', () => {
		expect(listMigrations(MIGRATIONS_DIR).length).toBeGreaterThan(80);
	});

	it('has well-formed, contiguous numbering with no new duplicate prefix', () => {
		expect(namingProblems(listMigrations(MIGRATIONS_DIR))).toEqual([]);
	});

	it('still has only the known duplicate prefixes (remove an entry once its file is renamed)', () => {
		const counts = new Map<string, number>();
		for (const file of listMigrations(MIGRATIONS_DIR)) {
			const prefix = NAME.exec(file)?.[1] ?? '';
			counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
		}
		const actual = [...counts].filter(([, n]) => n > 1).map(([prefix]) => prefix);
		expect(actual).toEqual(KNOWN_DUPLICATE_PREFIXES);
	});

	it('applies every migration, in D1 order, to an empty database', () => {
		const { db, failures } = applyAll(MIGRATIONS_DIR);
		expect(failures).toEqual([]);
		expect(db.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
	});

	it('produces the tables the application depends on', () => {
		const { db } = applyAll(MIGRATIONS_DIR);
		const tables = new Set(
			(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>).map((r) => r.name),
		);
		for (const required of [
			'members',
			'member_sessions',
			'join_requests',
			'login_attempts',
			'ask_inbox',
			'photos',
			'weekly_matchups',
			'weekly_votes',
			'events',
			'editorial_audit_events',
		]) {
			expect(tables.has(required), `missing table ${required}`).toBe(true);
		}
	});

	it('keeps one active matchup per week at the database level', () => {
		const { db } = applyAll(MIGRATIONS_DIR);
		db.exec("INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id) VALUES ('2099-01-04', 1, 2)");
		expect(() => db.exec("INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id) VALUES ('2099-01-04', 3, 4)")).toThrow(/UNIQUE/);
	});
});

describe('the migration check catches bad migrations (failing cases)', () => {
	function scratchDir(files: Record<string, string>): string {
		const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'migrations-'));
		for (const [name, sql] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), sql);
		return dir;
	}

	it('reports a migration whose SQL fails, by file name, and keeps going', () => {
		const dir = scratchDir({
			'0001_ok.sql': 'CREATE TABLE a (id INTEGER);',
			'0002_broken.sql': 'CREATE TABLE b (id INTEGER;',
			'0003_ok.sql': 'CREATE TABLE c (id INTEGER);',
		});
		const { db, failures } = applyAll(dir);
		expect(failures).toHaveLength(1);
		expect(failures[0]).toMatch(/^0002_broken\.sql:/);
		expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'c'").get()).toBeTruthy();
	});

	it('reports a migration that depends on a later one (wrong order)', () => {
		const dir = scratchDir({
			'0001_uses_table.sql': 'INSERT INTO later (id) VALUES (1);',
			'0002_creates_table.sql': 'CREATE TABLE later (id INTEGER);',
		});
		expect(applyAll(dir).failures.join('\n')).toMatch(/0001_uses_table\.sql: .*later/);
	});

	it('reports an empty migration file', () => {
		const dir = scratchDir({ '0001_empty.sql': '  \n' });
		expect(applyAll(dir).failures).toEqual(['0001_empty.sql: empty']);
	});

	it('flags a new duplicate prefix, a numbering gap and a bad name', () => {
		expect(namingProblems(['0001_a.sql', '0001_b.sql', '0002_c.sql'], [])).toEqual(['new duplicate prefix 0001: 0001_a.sql, 0001_b.sql']);
		expect(namingProblems(['0001_a.sql', '0003_c.sql'])).toEqual(['numbering gap: expected 0002 but found 0003']);
		expect(namingProblems(['0001_a.sql', 'add-things.sql'])).toEqual(['bad name: add-things.sql']);
	});

	it('allows the known historical duplicates but not others', () => {
		expect(namingProblems(['0020_a.sql', '0020_b.sql'], ['0020'])).toEqual([]);
		expect(namingProblems(['0021_a.sql', '0021_b.sql'], ['0020'])).toHaveLength(1);
	});
});
