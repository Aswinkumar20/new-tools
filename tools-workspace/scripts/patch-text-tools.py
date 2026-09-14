#!/usr/bin/env python3
"""Batch-patch TextToolBase HTML/TS files with processing overlay and stat formatting."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMP = ROOT / "libs/text-utilities/src/lib/component"
SHARED = ROOT / "libs/text-utilities/src/lib/shared"

OVERLAY_SNIPPET = """
      <lib-text-tool-processing-overlay
        [visible]="isProcessing"
        [label]="processingLabel"
        [progress]="processingProgress" />
"""

IMPORT_LINE = "import { TextToolProcessingOverlayComponent } from '../../shared/text-tool-processing-overlay.component';"

STAT_REPLACEMENTS = [
    (
        r'<span class="ttool__stat-value">\{\{ inputText\.length \}\}</span>',
        '<span class="ttool__stat-value" [title]="formatStatTitle(inputText.length)">{{ formatStatCount(inputText.length) }}</span>',
    ),
    (
        r'<span class="ttool__stat-value">\{\{ outputText\.length \}\}</span>',
        '<span class="ttool__stat-value" [title]="formatStatTitle(outputText.length)">{{ formatStatCount(outputText.length) }}</span>',
    ),
    (
        r'<span class="b64__stat-value">\{\{ inputText\.length \}\}</span>',
        '<span class="b64__stat-value" [title]="formatStatTitle(inputText.length)">{{ formatStatCount(inputText.length) }}</span>',
    ),
    (
        r'<span class="b64__stat-value">\{\{ outputText\.length \}\}</span>',
        '<span class="b64__stat-value" [title]="formatStatTitle(outputText.length)">{{ formatStatCount(outputText.length) }}</span>',
    ),
]

UPLOAD_TOOLTIP = (
    "isReadingFile ? 'Reading file…' : "
    "(isProcessing ? 'Upload another file (replaces current)' : 'Upload text file')"
)


def patch_html(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    original = text

    for pattern, repl in STAT_REPLACEMENTS:
        text = re.sub(pattern, repl, text)

    # Remove upload disabled during read
    text = re.sub(
        r'\[disabled\]="isReadingFile"\s*',
        "",
        text,
    )

    # Normalize upload tooltips
    text = re.sub(
        r"\[appTooltip\]=\"isReadingFile \? 'Reading file…' : 'Upload[^\"]*'\"",
        f"[appTooltip]=\"{UPLOAD_TOOLTIP}\"",
        text,
    )
    text = re.sub(
        r"\[appTooltip\]=\"isReadingFile \? 'Reading file…' : 'Upload file'\"",
        f"[appTooltip]=\"{UPLOAD_TOOLTIP}\"",
        text,
    )

    # Download button: add isExporting disabled + spinner icon where simple TXT pattern
    text = re.sub(
        r'\(click\)="downloadText\(\)" \[disabled\]="!hasOutput"',
        '(click)="downloadText()" [disabled]="!hasOutput || isExporting"',
        text,
    )
    text = re.sub(
        r"\(click\)=\"downloadText\(\)\" \[disabled\]=\"!hasOutput\" appTooltip=\"Download TXT\"",
        '(click)="downloadText()" [disabled]="!hasOutput || isExporting" appTooltip="Download TXT"',
        text,
    )
    text = re.sub(
        r"\(click\)=\"downloadText\(\)\" \[disabled\]=\"!hasOutput\" appTooltip=\"Download\"",
        '(click)="downloadText()" [disabled]="!hasOutput || isExporting" appTooltip="Download"',
        text,
    )

    text = re.sub(
        r"<img \[src\]=\\"assetService\.getAssetPath\(isExporting \? 'icons/spinner\.svg' : 'icons/txt\.svg'\)\\"",
        r'<img [src]="assetService.getAssetPath(isExporting ? \'icons/spinner.svg\' : \'icons/txt.svg\')"',
        text,
    )

    # Insert overlay after workspace opening if missing
    if "lib-text-tool-processing-overlay" not in text:
        def add_overlay(match: re.Match) -> str:
            line = match.group(0)
            indent = re.match(r"^(\s*)", line).group(1)
            snippet = OVERLAY_SNIPPET.replace("\n      ", f"\n{indent}      ")
            return line + snippet

        text = re.sub(
            r'^\s*<div class="(?:ttool|b64)__workspace[^"]*">\s*$',
            add_overlay,
            text,
            count=1,
            flags=re.MULTILINE,
        )

    # find-and-replace: replace inline processing block with shared overlay
    if "find-and-replace.html" in path.name:
        text = re.sub(
            r"\s*@if \(isProcessing\) \{[\s\S]*?\}\s*\n\s*<div class=\"ttool__editors\"",
            f"{OVERLAY_SNIPPET}\n\n      <div class=\"ttool__editors\"",
            text,
            count=1,
        )

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def patch_ts(path: Path) -> bool:
    if not path.name.endswith(".ts") or path.name.endswith(".spec.ts"):
        return False
    text = path.read_text(encoding="utf-8")
    if "extends TextToolBase" not in text:
        return False
    original = text

    if "TextToolProcessingOverlayComponent" not in text:
        # Insert import after TextToolBase import
        text = re.sub(
            r"(import \{ TextToolBase \} from '\.\./\.\./shared/text-tool-base';)",
            r"\1\n" + IMPORT_LINE,
            text,
            count=1,
        )
        # Add to imports array
        text = re.sub(
            r"(imports:\s*\[[^\]]*)(\])",
            r"\1, TextToolProcessingOverlayComponent\2",
            text,
            count=1,
        )

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    html_changed = []
    ts_changed = []

    for html in sorted(COMP.rglob("*.html")):
        if patch_html(html):
            html_changed.append(html.relative_to(ROOT))

    for ts in sorted(COMP.rglob("*.ts")):
        if patch_ts(ts):
            ts_changed.append(ts.relative_to(ROOT))

    print(f"HTML patched: {len(html_changed)}")
    for p in html_changed:
        print(f"  {p}")
    print(f"TS patched: {len(ts_changed)}")
    for p in ts_changed:
        print(f"  {p}")


if __name__ == "__main__":
    main()
