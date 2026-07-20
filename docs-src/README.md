# Documentation sources

Markdown sources for the PDFs in [`../docs/`](../docs/). Edit here, then
regenerate — do not edit the PDFs directly.

| Source | Renders to |
| ------ | ---------- |
| `01-technical-approach.md` | `docs/01-technical-approach.pdf` |
| `02-why-what-how.md` | `docs/02-why-what-how.pdf` |
| `03-user-guide.md` | `docs/03-user-guide.pdf` |
| *(all three)* | `docs/combatx-documentation.pdf` |

## Regenerating

```bash
python3 scripts/make-docs-pdf.py --combined
```

Requires **Chrome or Chromium** (already present on most machines) and Python's
`markdown` module. No pandoc or LaTeX needed — the script renders Markdown to
styled HTML and prints it with headless Chrome.

Drop `--combined` to skip the merged document.

### If you'd rather use pandoc

```bash
for f in docs-src/0*.md; do
  pandoc "$f" -o "docs/$(basename "${f%.md}").pdf" \
    --pdf-engine=weasyprint --toc
done
```

> The ASCII architecture diagrams live inside fenced code blocks, so they
> survive conversion as monospaced text. If a diagram wraps or misaligns in
> output, the culprit is a proportional font or too-wide page margins.
