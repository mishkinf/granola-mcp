# Granola Extractor Agent Instructions

This repo is the Granola-specific adapter. Keep Granola knowledge here; do not add Granola-specific parsing or sync behavior to Lore core.

## Lore Projection Contract

The Lore-facing output is `export/lore/<granola-document-id>.md`.

These files are the canonical, human-correctable documents that Lore should ingest. They use generic frontmatter so Lore does not need to know about Granola:

```yaml
---
source_id: "granola:<granola-document-id>"
source_type: "granola"
source_date: 2026-03-03T19:01:27.081Z
granola_id: <granola-document-id>
title: "Meeting title"
created_at: 2026-03-03T19:01:27.081Z
---
```

## Generated vs Canonical Files

Treat the regular export directories as generated Granola cache:

- `export/<title-or-id>/document.json`
- `export/<title-or-id>/transcript.json`
- `export/<title-or-id>/transcript.md`
- `export/<title-or-id>/transcript.txt`
- `export/<title-or-id>/notes.md`
- `export/<title-or-id>/combined.md`

Do not ask users to make durable speaker-attribution edits in those files. They may be rewritten by future extraction.

Treat `export/lore/*.md` as human-owned canonical input to Lore. Users may fix speaker attribution, typoed names, transcript text, headings, or notes there.

## Transcript Correction Policy

When a user wants better speaker attribution or transcript cleanup:

- Edit `export/lore/<granola-document-id>.md`.
- Preserve `source_id`, `source_date`, and `granola_id` unless the user explicitly asks to correct source metadata.
- Do not edit `document.json`, `transcript.json`, `transcript.md`, `notes.md`, or `combined.md` as the durable fix.
- After correcting canonical Lore docs, run Lore sync from the Lore repo so only changed canonical files are re-indexed.

## Preservation Rule

By default, commands preserve existing `export/lore/*.md` files:

```bash
npm run dev -- export-lore ./export
npm run dev -- sync ./export
npm run dev -- export ./export
```

Existing Lore projection files should be reported as `preserved`, not overwritten.

Only overwrite canonical Lore docs when the user explicitly asks:

```bash
npm run dev -- export-lore ./export --force
npm run dev -- sync ./export --force-lore
npm run dev -- export ./export --force-lore
```

Only delete stale canonical Lore docs when explicitly asked:

```bash
npm run dev -- export-lore ./export --prune
npm run dev -- sync ./export --prune-lore
npm run dev -- export ./export --prune-lore
```

## Correct Workflow

1. Run Granola extraction normally.
2. New meetings create new `export/lore/<id>.md` files.
3. Correct speaker attribution in `export/lore/<id>.md`.
4. Future extractions preserve corrected files.
5. Point Lore sync at `export/lore/*.md` after the existing Lore source rows have been migrated to the stable projection paths.
6. During routine syncs, do not use `--force-lore` or `--prune-lore` unless the user clearly asks for regeneration or deletion.

## Development Guardrails

- Keep `source_id` generic in Lore-facing Markdown. Use `granola:<id>` as the value, but do not require Lore to understand Granola.
- Do not make `combined.md` the canonical Lore input.
- Do not add Granola-specific code to Lore unless the user explicitly asks to break the adapter boundary.
- Prefer stable IDs over title-derived paths. Granola titles can change and leave stale directories behind.
- Run `npm run build` after code changes.
