#!/usr/bin/env python3
"""Render docs-src/*.md to print-ready PDFs in docs/ via headless Chrome.

Markdown -> styled HTML -> PDF. Chrome is used because it is already present on
most dev machines and needs no system packages; pandoc/LaTeX are not required.

Usage:
    python3 scripts/make-docs-pdf.py            # one PDF per document
    python3 scripts/make-docs-pdf.py --combined # plus a single merged PDF
"""

from __future__ import annotations

import argparse
import html
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    import markdown
except ImportError:
    sys.exit("python3-markdown is required:  pip install --user markdown")

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs-src"  # Markdown sources
DOCS = ROOT / "docs"  # rendered PDFs (this is what ships)

CHROME_CANDIDATES = (
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
)

# Print stylesheet. Kept deliberately plain: the source documents carry ASCII
# diagrams inside <pre>, which must stay monospaced and must not wrap.
CSS = """
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body {
  font-family: -apple-system, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  font-size: 10.5pt; line-height: 1.55; color: #1a1a1a;
  margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact;
}
h1, h2, h3, h4 { line-height: 1.25; font-weight: 650; margin: 1.6em 0 0.6em; }
h1 { font-size: 21pt; border-bottom: 2px solid #1a1a1a; padding-bottom: .3em;
     margin-top: 0; }
h2 { font-size: 15pt; border-bottom: 1px solid #d0d0d0; padding-bottom: .25em;
     margin-top: 1.9em; }
h3 { font-size: 12pt; }
h4 { font-size: 10.5pt; letter-spacing: .02em; }
h2, h3 { break-after: avoid; }
p, li { orphans: 3; widows: 3; }
a { color: #0b57d0; text-decoration: none; }
code {
  font-family: "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  font-size: 9pt; background: #f2f2f4; padding: .12em .35em; border-radius: 3px;
}
pre {
  background: #f7f7f9; border: 1px solid #e2e2e6; border-radius: 5px;
  padding: 10px 12px; overflow: visible; break-inside: avoid;
  white-space: pre; font-size: 7.6pt; line-height: 1.32;
}
pre code { background: none; padding: 0; font-size: inherit; }
table {
  border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 9.2pt;
  break-inside: avoid;
}
th, td { border: 1px solid #d8d8dc; padding: 6px 9px; text-align: left;
         vertical-align: top; }
th { background: #f2f2f4; font-weight: 620; }
blockquote {
  margin: 1em 0; padding: .5em 1em; border-left: 3px solid #c8c8cc;
  background: #fafafb; color: #444;
}
hr { border: none; border-top: 1px solid #e0e0e4; margin: 2em 0; }
/* Cover-ish treatment for the byline under each H1. */
h1 + p { color: #555; font-size: 9.5pt; margin-top: -.2em; }
"""

PAGE = """<!doctype html>
<html><head><meta charset="utf-8"><title>{title}</title>
<style>{css}</style></head><body>{body}</body></html>"""


def find_chrome() -> str:
    for name in CHROME_CANDIDATES:
        path = shutil.which(name)
        if path:
            return path
    sys.exit(
        "No Chrome/Chromium found. Install one, or use pandoc instead "
        "(see docs-src/README.md)."
    )


def rewrite_links(text: str) -> str:
    """Point inter-document links at the sibling .pdf files."""
    text = re.sub(r"\]\((0\d-[^)]+?)\.md((?:#[^)]*)?)\)", r"](\1.pdf\2)", text)
    # ../SETUP.md has no PDF counterpart; leave it as a plain label.
    return text.replace("](../SETUP.md)", "](#)")


def convert(md_path: Path, chrome: str, out_dir: Path) -> Path:
    raw = rewrite_links(md_path.read_text(encoding="utf-8"))
    body = markdown.markdown(
        raw,
        extensions=["tables", "fenced_code", "toc", "sane_lists", "attr_list"],
    )
    title = html.escape(md_path.stem.replace("-", " ").title())
    out_pdf = out_dir / f"{md_path.stem}.pdf"

    with tempfile.NamedTemporaryFile(
        "w", suffix=".html", delete=False, encoding="utf-8"
    ) as tmp:
        tmp.write(PAGE.format(title=title, css=CSS, body=body))
        tmp_path = Path(tmp.name)

    try:
        subprocess.run(
            [
                chrome,
                "--headless",
                "--disable-gpu",
                "--no-sandbox",
                "--no-pdf-header-footer",
                f"--print-to-pdf={out_pdf}",
                tmp_path.as_uri(),
            ],
            check=True,
            capture_output=True,
            timeout=120,
        )
    finally:
        tmp_path.unlink(missing_ok=True)

    return out_pdf


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--combined",
        action="store_true",
        help="also emit a single merged PDF of all documents",
    )
    args = ap.parse_args()

    chrome = find_chrome()
    sources = sorted(SRC.glob("0*.md"))
    if not sources:
        sys.exit(f"No numbered documents found in {SRC}")

    for src in sources:
        pdf = convert(src, chrome, DOCS)
        size = pdf.stat().st_size / 1024
        print(f"  {src.name:<32} -> {pdf.name}  ({size:.0f} KB)")

    if args.combined:
        merged = rewrite_links(
            "\n\n<div style='break-before:page'></div>\n\n".join(
                s.read_text(encoding="utf-8") for s in sources
            )
        )
        tmp_md = SRC / ".combined.md"
        tmp_md.write_text(merged, encoding="utf-8")
        try:
            pdf = convert(tmp_md, chrome, DOCS)
            final = DOCS / "combatx-documentation.pdf"
            pdf.replace(final)
            print(
                f"  {'(all three)':<32} -> {final.name}  "
                f"({final.stat().st_size / 1024:.0f} KB)"
            )
        finally:
            tmp_md.unlink(missing_ok=True)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
