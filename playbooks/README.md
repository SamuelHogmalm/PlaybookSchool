# Source playbooks

Drop FastDraw PDF exports here. Check the book parses before spending anything on it:

```bash
services/importer/.venv/Scripts/python.exe scripts/run-interpret-v2.py \
  --pdf playbooks/your-book.pdf --all-plays --dry-run
```

That prints every play the parser found and how many frames each has, and renders the
frame crops. If a play is missing or a frame count looks wrong, the parser did not read
the book and no amount of AI will fix it.

Then run the import:

```bash
services/importer/.venv/Scripts/python.exe scripts/run-interpret-v2.py \
  --pdf playbooks/your-book.pdf \
  --all-plays \
  --out src/data/plays-candidate.json
```

Crops are rendered from the PDF automatically the first time a book is imported, into
`public/dev-repairs/crops` (override with `--crops-dir`).

`--all-plays` matters for a book we have not imported before: without it the run only
keeps plays whose names already appear in the current seed, which for a new book is none
of them.

Then compare before adopting anything:

```bash
npx tsx scripts/compare-interpret.ts src/data/plays-interpreted.json src/data/plays-candidate.json
```

A candidate only becomes the seed if it wins on that comparison — see `DECISIONS.md`,
2026-08-17, where one was rejected for producing a single invalid play.

PDFs here are not committed; they are somebody's playbook.
