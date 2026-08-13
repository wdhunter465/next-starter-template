---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers
Authority Level: Evidence / Design Record
Owns: Design, threat model, and test evidence for the #3163 magic-bytes upload validation module
Does Not Own: #2857 photo-intake route/API implementation, moderation workflow, B2/D1 wiring, or Production promotion authority
Canonical Reference: /docs/ops/pmo/pmo-backlog.md
Related Issues: #3163, #2857, #2878
Last Reviewed: 2026-08-08
---

# Magic-bytes upload validation — design and test evidence (#3163)

## Status

**Non-production, feeds #2857.** This module is a pure validation function with unit-test evidence only. It is not wired to any route, does not touch B2 or D1, and does not change any production behavior. It exists so #2857's upload-validation work unit has a tested, ready-to-use building block once #2857's entry gate (#2860 completed and accepted) clears.

## Objective

Implement the "reject SVG, executable/polyglot formats, mismatched MIME/magic bytes, invalid dimensions" requirement recorded in #2857's Project Graduation launch package, as a standalone, dependency-free, fully tested function — per the #2878 code-level review's recommendation to use a first-party pattern (magic-byte/signature inspection) rather than trusting `Content-Type` headers or file extensions.

## What was built

- `functions/_lib/photo-upload-validation.ts` — `validatePhotoUpload({ bytes, declaredMimeType })`, a pure function taking raw bytes and an optional client-declared MIME type, returning a discriminated-union result (`{ ok: true, format, mimeType, byteLength, dimensions }` or `{ ok: false, code, error }`).
- `tests/photo-upload-validation.test.ts` — 29 tests, all passing, using spec-correct constructed fixtures (a real, fully valid PNG built with `node:zlib` deflate and real CRC-32 checksums; spec-correct JPEG marker segments; spec-correct WebP RIFF chunks), not hand-picked magic numbers alone.

## Threat model and what each check defends against

| Check | Defends against |
|---|---|
| Size ceiling (10 MiB, per #2857's accepted decision) | Resource exhaustion / storage abuse |
| Fixed-offset dangerous-signature check (PDF, Windows EXE, ELF, ZIP-family) | Files disguised as photos that are actually executables or archives |
| Allowlisted signature detection (JPEG/PNG/WebP only) | Anything not one of the three accepted formats, including SVG (SVG is XML text and never matches a binary image prefix, so it is rejected here even without a dedicated SVG rule) |
| Declared-MIME-type cross-check against the detected signature | Renamed-extension attacks (e.g., a `.php` file uploaded with a spoofed `image/jpeg` `Content-Type`) |
| Bounded textual polyglot scan (`<?php`, `<%`, `<script`, `<svg`, `<?xml`, `<html` in the first 64 KiB) | Files that pass the binary signature check but carry an executable/script payload appended or embedded near the start (a real, documented image-polyglot pattern) |
| Full-buffer scan for an embedded ZIP local-file-header (`PK\x03\x04`) | JPEG/PNG-plus-ZIP polyglots, where a valid image is concatenated with an archive structure that a different parser (or a misconfigured server) would recognize |
| Format-specific structural/dimension parsing (PNG IHDR, JPEG SOF marker scan, WebP VP8X extended header) | Truncated/malformed files and absurd dimension claims; fails closed (rejects) when a file claims to be one of the three formats but its structure can't be read |

## Known, explicit limitation (not hidden)

WebP dimension parsing is implemented only for the **VP8X extended-header** chunk variant, which is simple, byte-aligned, and low-risk to implement correctly. Plain lossy (`VP8 `) and lossless (`VP8L`) WebP files without a VP8X chunk require bit-level bitstream parsing (14-bit packed fields for `VP8L`, a start-code-relative offset for `VP8 `) that could not be verified with high confidence from memory without a reference decoder to test against. Rather than ship unverified bit-math framed as correct, those two variants are accepted with `dimensions: null` — the signature, size, MIME cross-check, and polyglot defenses still apply in full; only the dimension-bound check is skipped for that specific subtype. This is called out here so it's a visible, reviewable decision rather than a silent gap. If full WebP dimension coverage is required before promotion, follow-up work should either implement and test the `VP8`/`VP8L` bit-unpacking against real reference images, or take a maintained dependency for that narrow purpose.

## Test evidence

```
npx vitest run tests/photo-upload-validation.test.ts
✓ 29 tests passed

npx vitest run   (full suite)
✓ 974 tests passed, 93 test files, 0 regressions

npx tsc --noEmit
✓ clean

npx eslint functions/_lib/photo-upload-validation.ts tests/photo-upload-validation.test.ts
✓ clean
```

Coverage includes: valid JPEG/PNG/WebP (VP8X) acceptance with correct dimension extraction; the documented plain-WebP gap; renamed-extension MIME mismatch; unsupported declared type; charset-parameter tolerance; SVG rejection; PDF/EXE/ELF rejection; JPEG+ZIP polyglot; JPEG+`<script>` polyglot; JPEG+`<?php` polyglot; truncated PNG (no IHDR); JPEG with no SOF; JPEG cut mid-header; WebP with unaccounted trailing data; zero and over-ceiling dimensions; exact-boundary dimension and file-size acceptance; empty file; unrecognized formats (plain text, GIF).

## Explicitly out of scope for this module

- Filename-extension checking (the #2857 requirement is specifically MIME/magic-byte matching; extension checks were not requested and add little once signature+MIME are both checked).
- Any B2/D1/network/route wiring — this is a pure function only.
- Image decodability/corruption-beyond-header checks (e.g., a JPEG with a valid header but corrupted entropy-coded data would currently pass; full decodability proof would require an actual decoder, which is out of scope for a zero-dependency validator).
- Malware/content scanning unrelated to file-format structure.

## Review checklist for the promotion decision

- [ ] Threat model above reviewed and accepted as sufficient for launch, or follow-up scoped for gaps.
- [ ] WebP VP8/VP8L dimension-parsing gap explicitly accepted or routed to follow-up.
- [ ] Confirm this module is wired into #2857's actual upload handler only after #2857's entry gate (#2860) clears — no route currently calls it.
- [ ] Decision (Adopt as-is / Adopt with follow-up / Revise) recorded back in #3163 and #2878.
