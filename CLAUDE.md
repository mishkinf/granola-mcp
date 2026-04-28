# Claude Code Instructions

Read and follow `AGENTS.md` in this repo.

Critical rule: `export/lore/*.md` files are canonical, human-correctable Lore input. Preserve them by default. Do not overwrite corrected speaker attribution unless the user explicitly asks for `--force`, `--force-lore`, or equivalent behavior.

If asked to fix transcript attribution, edit the relevant `export/lore/<id>.md` file directly and then run Lore sync from the Lore repo. Do not make durable corrections in raw Granola export files.

Granola-specific processing belongs in this repo. Lore core should only receive generic Lore-ready Markdown with stable `source_id` frontmatter.
