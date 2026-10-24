---
Doc Type: Specification
Audience: Human + AI
Authority Level: Canonical Architecture Specification
Owns: System architecture, data flows, access model, runtime dependencies
Does Not Own: Operational runbooks; governance policies; UI/UX design specifics
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-10-23
---

# CMS Data Layer — Phase 2B

## Overview

Phase 2B introduces the foundational CMS data layer in D1, enabling future Admin CMS functionality and database-backed content management. This layer provides schema, seed data, and read helpers without modifying public page rendering.

## Database Schema

### content_blocks Table

The `content_blocks` table stores the current state of each editable CMS content block.

**Columns:**
- `key` (TEXT, PRIMARY KEY) - Unique identifier for the block (format: `<page>.<section>.<slot>`)
- `page` (TEXT, NOT NULL) - Page identifier (e.g., 'home', 'about', 'charities')
- `section` (TEXT, NOT NULL) - Section within the page (e.g., 'hero', 'intro', 'bio')
- `title` (TEXT, NOT NULL) - Human-readable title for the block
- `body_md` (TEXT, NOT NULL) - Current/draft markdown content
- `status` (TEXT, NOT NULL) - Block status: 'draft' or 'published'
- `published_body_md` (TEXT, NULL) - Published version of markdown content
- `version` (INTEGER, NOT NULL, DEFAULT 1) - Version number for tracking changes
- `updated_at` (TEXT, NOT NULL) - ISO8601 timestamp of last update
- `published_at` (TEXT, NULL) - ISO8601 timestamp of last publish
- `updated_by` (TEXT, NOT NULL, DEFAULT 'admin') - User who made the last update

**Indexes:**
- `idx_content_blocks_page` on (page)
- `idx_content_blocks_status` on (status)
- `idx_content_blocks_updated_at` on (updated_at)

**Status Constraint:**
- Status must be either 'draft' or 'published'

### content_revisions Table

The `content_revisions` table stores historical versions of content blocks for audit and rollback purposes.

**Columns:**
- `id` (INTEGER, PRIMARY KEY AUTOINCREMENT) - Unique revision identifier
- `key` (TEXT, NOT NULL) - Foreign reference to content_blocks.key
- `version` (INTEGER, NOT NULL) - Version number of this revision
- `body_md` (TEXT, NOT NULL) - Markdown content at this version
- `status` (TEXT, NOT NULL) - Status at time of revision
- `updated_at` (TEXT, NOT NULL) - ISO8601 timestamp of this revision
- `updated_by` (TEXT, NOT NULL) - User who created this revision

**Indexes:**
- `idx_content_revisions_key_version` on (key, version)

## Key Naming Convention

Content block keys follow a strict three-part format:

```
<page>.<section>.<slot>
```

**Examples:**
- `home.hero.primary` - Primary hero section on home page
- `about.bio.primary` - Primary bio section on about page
- `charities.overview.primary` - Primary overview section on charities page

**Components:**
- **page**: Identifies which page the content belongs to (e.g., 'home', 'about', 'charities')
- **section**: Identifies the section within the page (e.g., 'hero', 'intro', 'bio')
- **slot**: Identifies the position within the section (typically 'primary' for single blocks)

## Seed Data

### Seed Script Location
`/scripts/seed_cms_content_blocks.mjs`

### Running the Seed

To seed baseline CMS content blocks:

```bash
# Ensure migration is applied first
npx wrangler d1 migrations apply lgfc_lite --local

# Run the seed script
node scripts/seed_cms_content_blocks.mjs
```

### Seed Behavior

- **Idempotent**: Uses `INSERT OR IGNORE` so it can be run multiple times safely without creating duplicates
- **Draft-only**: All seeded blocks start with status='draft'
- **Placeholder content**: Includes basic placeholder markdown for each block
- **Initial version**: All blocks start at version=1
- **Seed attribution**: Sets `updated_by='seed'` to indicate seed origin

### Seeded Keys

The seed script creates the following 9 baseline content blocks:

1. `home.hero.primary` - Home page hero section
2. `home.intro.primary` - Home page introduction
3. `about.bio.primary` - About page biography section
4. `charities.overview.primary` - Charities page overview
5. `events.intro.primary` - Events page introduction
6. `library.intro.primary` - Library page introduction
7. `photos.intro.primary` - Photos page introduction
8. `memorabilia.intro.primary` - Memorabilia page introduction
9. `join.intro.primary` - Join page introduction

### Verification

After running the seed, verify the data:

```bash
npx wrangler d1 execute lgfc_lite --local --command \
  "SELECT key, page, status FROM content_blocks ORDER BY key;"
```

## Read Helper Functions

### Module Location
`/src/lib/cmsContent.ts`

### Available Functions

#### getPublishedBlocksByPage(db, page)

Returns all published content blocks for a specific page.

**Parameters:**
- `db` (D1Database) - D1 database instance (env.DB)
- `page` (string) - Page identifier (e.g., 'home', 'about')

**Returns:**
- `Promise<ContentBlock[]>` - Array of published blocks

**Usage:**
```typescript
import { getPublishedBlocksByPage } from '@/lib/cmsContent';

const blocks = await getPublishedBlocksByPage(env.DB, 'home');
```

#### getDraftBlocksByPage(db, page)

Returns all content blocks (all statuses) for a specific page, ordered by section and key. Used for admin listing and preview.

**Parameters:**
- `db` (D1Database) - D1 database instance (env.DB)
- `page` (string) - Page identifier

**Returns:**
- `Promise<ContentBlock[]>` - Array of all blocks for the page

**Usage:**
```typescript
import { getDraftBlocksByPage } from '@/lib/cmsContent';

const blocks = await getDraftBlocksByPage(env.DB, 'home');
```

#### getBlockByKey(db, key)

Returns a single content block by its key, including full data (both draft and published content).

**Parameters:**
- `db` (D1Database) - D1 database instance (env.DB)
- `key` (string) - Block key (e.g., 'home.hero.primary')

**Returns:**
- `Promise<ContentBlock | null>` - Block data or null if not found

**Usage:**
```typescript
import { getBlockByKey } from '@/lib/cmsContent';

const block = await getBlockByKey(env.DB, 'home.hero.primary');
```

## Migration File

Migration: `/migrations/0011_cms_content_blocks.sql`

This migration creates both `content_blocks` and `content_revisions` tables with all required indexes.

## Future Work (Not in Phase 2B)

Phase 2B is **foundation only**. The following are explicitly out of scope:

- Admin UI for editing content blocks
- Publishing workflow (draft → published transition)
- Integration with public page rendering
- Content block versioning/rollback UI
- Content preview functionality

These features will be implemented in later phases once the foundation is stable.

## References

- Migration: `/migrations/0011_cms_content_blocks.sql`
- Seed script: `/scripts/seed_cms_content_blocks.mjs`
- Read helpers: `/src/lib/cmsContent.ts`
- Overall architecture and design authority: `/docs/reference/design/LGFC-Production-Design-and-Standards.md` (`/docs/reference/architecture/cms.md` is a historical pointer only)
