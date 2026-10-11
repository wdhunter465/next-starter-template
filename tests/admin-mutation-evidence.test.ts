// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// #4466 (gap row 30): mutation audit evidence per admin mutation type.
//
// The gap assessment says "evidence per mutation type not enumerated". This enumerates it.
// Every handler under functions/api/admin that exports a POST/PUT/PATCH/DELETE method is
// classified by the evidence it leaves behind, and the classification is pinned in
// tests/fixtures/admin-mutation-evidence.json:
//
//   audit-trail  writes a structured audit event (editorial_audit_events, matchup repair audit)
//   row-actor    records who acted in the changed row (updated_by, approved_by, deleted_by, ...)
//   none         leaves no actor or audit evidence that this check can see
//
// The check is static and heuristic: it reads the handler source (following a re-export) and
// looks for audit-writing calls or *_by / actor columns. It cannot prove evidence is written on
// every path, and a comment-only mention does not count. What it does guarantee:
//   - a new admin mutation handler cannot be added without being classified;
//   - evidence cannot be silently lost (a handler moving down a class fails the test);
//   - evidence that is added must be recorded (a handler moving up fails until the manifest is
//     updated), so the pinned list only ratchets toward more evidence;
//   - the "none" set is visible and tracked on #4466, not hidden.
// Regenerate with: UPDATE_ADMIN_MUTATION_EVIDENCE=1 npx vitest run tests/admin-mutation-evidence.test.ts

type EvidenceClass = 'audit-trail' | 'row-actor' | 'none';
const RANK: Record<EvidenceClass, number> = { none: 0, 'row-actor': 1, 'audit-trail': 2 };

const ROOT = process.cwd();
const ADMIN_DIR = 'functions/api/admin';
const MANIFEST = path.join(ROOT, 'tests/fixtures/admin-mutation-evidence.json');

const MUTATION = /\bonRequest(?:Post|Put|Patch|Delete)\b/;
const REEXPORT = /export\s*\{[^}]*\bonRequest(?:Post|Put|Patch|Delete)\b[^}]*\}\s*from\s*['"]([^'"]+)['"]/;
const AUDIT = /record\w*Audit|logMatchupRepairAudit|editorial_audit|publication_audit/i;
const ACTOR = /\b[a-z]+(?:_[a-z]+)*_by\b|\bactor\b/;

function walk(dir: string): string[] {
	return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
		const rel = path.posix.join(dir, entry.name);
		return entry.isDirectory() ? walk(rel) : [rel];
	});
}

function stripComments(source: string): string {
	return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function readSource(file: string, seen = new Set<string>()): string {
	if (seen.has(file)) return '';
	seen.add(file);
	const raw = fs.readFileSync(path.join(ROOT, file), 'utf8');
	const source = stripComments(raw);
	const reexport = REEXPORT.exec(source);
	if (!reexport) return source;
	const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), reexport[1]));
	const resolved = [`${target}.ts`, `${target}/index.ts`].find((c) => fs.existsSync(path.join(ROOT, c)));
	return resolved ? `${source}\n${readSource(resolved, seen)}` : source;
}

function classify(file: string): EvidenceClass {
	const source = readSource(file);
	if (AUDIT.test(source)) return 'audit-trail';
	if (ACTOR.test(source)) return 'row-actor';
	return 'none';
}

function mutationHandlers(): string[] {
	return walk(ADMIN_DIR)
		.filter((f) => f.endsWith('.ts') && MUTATION.test(stripComments(fs.readFileSync(path.join(ROOT, f), 'utf8'))))
		.sort();
}

function current(): Record<string, EvidenceClass> {
	return Object.fromEntries(mutationHandlers().map((f) => [f, classify(f)]));
}

type Manifest = { tracking: string; handlers: Record<string, EvidenceClass> };

if (process.env.UPDATE_ADMIN_MUTATION_EVIDENCE === '1') {
	fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
	const manifest: Manifest = { tracking: '#4466', handlers: current() };
	fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, '\t')}\n`);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Manifest;

describe('admin mutation evidence is enumerated (#4466 row 30)', () => {
	const now = current();

	it('finds the admin mutation handlers', () => {
		expect(Object.keys(now).length).toBeGreaterThan(30);
	});

	it('classifies every admin mutation handler in the manifest', () => {
		const unclassified = Object.keys(now).filter((f) => !(f in manifest.handlers));
		expect(unclassified, 'new admin mutation handlers need an entry (run with UPDATE_ADMIN_MUTATION_EVIDENCE=1)').toEqual([]);
	});

	it('has no manifest entry for a handler that no longer exists', () => {
		const stale = Object.keys(manifest.handlers).filter((f) => !(f in now));
		expect(stale).toEqual([]);
	});

	it('never loses evidence a handler already had', () => {
		const lost = Object.entries(manifest.handlers)
			.filter(([f, was]) => f in now && RANK[now[f]] < RANK[was])
			.map(([f, was]) => `${f}: ${was} -> ${now[f]}`);
		expect(lost).toEqual([]);
	});

	it('records evidence that has been added', () => {
		const gained = Object.entries(manifest.handlers)
			.filter(([f, was]) => f in now && RANK[now[f]] > RANK[was])
			.map(([f, was]) => `${f}: ${was} -> ${now[f]}`);
		expect(gained, 'evidence improved: update the manifest so it cannot regress').toEqual([]);
	});

	it('names the tracking Issue for the handlers with no evidence', () => {
		const none = Object.values(manifest.handlers).filter((c) => c === 'none');
		if (none.length > 0) expect(manifest.tracking).toMatch(/^#\d+$/);
	});

	it('does not count a comment-only mention as evidence', () => {
		expect(stripComments('// updated_by recorded here\nconst x = 1;')).not.toMatch(ACTOR);
		expect(stripComments('/* recordEditorialAudit */\nconst x = 1;')).not.toMatch(AUDIT);
		expect(stripComments('const url = "https://x.test"; // updated_by')).not.toMatch(ACTOR);
	});
});
