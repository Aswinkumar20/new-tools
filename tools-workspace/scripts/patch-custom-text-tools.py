#!/usr/bin/env python3
"""Patch custom-layout text tool HTML with processing overlay and compact stats."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
COMP = ROOT / "libs/text-utilities/src/lib/component"

OVERLAY = """
      <lib-text-tool-processing-overlay
        [visible]="isProcessing"
        [label]="processingLabel"
        [progress]="processingProgress" />
"""

PATCHES = [
    {
        "html": COMP / "textCaseConvertor/text-case-convertor.html",
        "workspace": "tcc__workspace",
        "stats": [
            (r'<span class="tcc__stat-value">\{\{ wordCount \}\}</span>',
             '<span class="tcc__stat-value" [title]="formatStatTitle(wordCount)">{{ formatStatCount(wordCount) }}</span>'),
            (r'<span class="tcc__stat-value">\{\{ charCount \}\}</span>',
             '<span class="tcc__stat-value" [title]="formatStatTitle(charCount)">{{ formatStatCount(charCount) }}</span>'),
            (r'<span class="tcc__stat-value">\{\{ convertedText\.length \}\}</span>',
             '<span class="tcc__stat-value" [title]="formatStatTitle(convertedText.length)">{{ formatStatCount(convertedText.length) }}</span>'),
        ],
    },
    {
        "html": COMP / "removeDuplicateLines/remove-duplicate-lines.html",
        "workspace": "rdl__workspace",
        "stats": [
            (r'<span class="rdl__stat-value">\{\{ wordCount \}\}</span>',
             '<span class="rdl__stat-value" [title]="formatStatTitle(wordCount)">{{ formatStatCount(wordCount) }}</span>'),
            (r'<span class="rdl__stat-value">\{\{ removedCount \}\}</span>',
             '<span class="rdl__stat-value" [title]="formatStatTitle(removedCount)">{{ formatStatCount(removedCount) }}</span>'),
            (r'<span class="rdl__stat-value">\{\{ duplicateCount \}\}</span>',
             '<span class="rdl__stat-value" [title]="formatStatTitle(duplicateCount)">{{ formatStatCount(duplicateCount) }}</span>'),
        ],
    },
    {
        "html": COMP / "textToASCII/text-to-ASCII.html",
        "workspace": "tta__workspace",
        "stats": [
            (r'<span class="tta__stat-value">\{\{ inputValue\.length \}\}</span>',
             '<span class="tta__stat-value" [title]="formatStatTitle(inputValue.length)">{{ formatStatCount(inputValue.length) }}</span>'),
            (r'<span class="tta__stat-value">\{\{ outputValue\.length \}\}</span>',
             '<span class="tta__stat-value" [title]="formatStatTitle(outputValue.length)">{{ formatStatCount(outputValue.length) }}</span>'),
        ],
    },
    {
        "html": COMP / "textReverserAndPalindromeChecker/text-reversal-and-palindrome-checker.html",
        "workspace": "trp__workspace",
        "stats": [
            (r'<span class="trp__stat-value">\{\{ inputText\.length \}\}</span>',
             '<span class="trp__stat-value" [title]="formatStatTitle(inputText.length)">{{ formatStatCount(inputText.length) }}</span>'),
        ],
    },
    {
        "html": COMP / "slugGenerator/slug-generator.html",
        "workspace": "sg__workspace",
        "stats": [
            (r'<span class="sg__stat-value">\{\{ inputText\.length \}\}</span>',
             '<span class="sg__stat-value" [title]="formatStatTitle(inputText.length)">{{ formatStatCount(inputText.length) }}</span>'),
        ],
    },
    {
        "html": COMP / "textDifferrence/text-difference.html",
        "workspace": "td__workspace",
        "stats": [],
    },
    {
        "html": COMP / "codeMerge/code-merge.html",
        "workspace": "cm__workspace",
        "stats": [
            (r'<span class="cm__stat-value">\{\{ leftLineCount \}\}</span>',
             '<span class="cm__stat-value" [title]="formatStatTitle(leftLineCount)">{{ formatStatCount(leftLineCount) }}</span>'),
            (r'<span class="cm__stat-value">\{\{ rightLineCount \}\}</span>',
             '<span class="cm__stat-value" [title]="formatStatTitle(rightLineCount)">{{ formatStatCount(rightLineCount) }}</span>'),
        ],
    },
]

UPLOAD_TOOLTIP = (
    "isReadingFile ? 'Reading file…' : "
    "(isProcessing ? 'Upload another file (replaces current)' : 'Upload text file')"
)


def patch_file(cfg: dict) -> bool:
    path: Path = cfg["html"]
    if not path.exists():
        return False
    text = path.read_text(encoding="utf-8")
    original = text

    for pattern, repl in cfg.get("stats", []):
        text = re.sub(pattern, repl, text)

    text = re.sub(r'\[disabled\]="isReadingFile"\s*', "", text)
    text = re.sub(
        r"\[appTooltip\]=\"isReadingFile \? 'Reading[^\"]*'\"",
        f'[appTooltip]="{UPLOAD_TOOLTIP}"',
        text,
    )
    text = re.sub(
        r"\[appTooltip\]=\"isReadingFile \? 'Reading…' : 'Upload'\"",
        f'[appTooltip]="{UPLOAD_TOOLTIP}"',
        text,
    )

    ws = cfg["workspace"]
    if "lib-text-tool-processing-overlay" not in text:
        text = re.sub(
            rf'(\s*<div class="{ws}">)\s*\n',
            r"\1\n" + OVERLAY + "\n",
            text,
            count=1,
        )

    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def patch_scss(workspace_class: str, scss_path: Path) -> bool:
    if not scss_path.exists():
        return False
    text = scss_path.read_text(encoding="utf-8")
    original = text
    if "text-tool-layout.scss" not in text:
        text = "@use '../../shared/text-tool-layout.scss';\n\n" + text
    if f".{workspace_class}" in text and "position: relative" not in text.split(workspace_class)[1][:200]:
        text = re.sub(
            rf"(\.{workspace_class} \{{\n)(  flex:)",
            r"\1  position: relative;\n\2",
            text,
            count=1,
        )
    if text != original:
        scss_path.write_text(text, encoding="utf-8")
        return True
    return False


if __name__ == "__main__":
    for cfg in PATCHES:
        if patch_file(cfg):
            print(f"HTML: {cfg['html'].relative_to(ROOT)}")
        scss = cfg["html"].with_suffix(".scss")
        ws = cfg["workspace"]
        if patch_scss(ws, scss):
            print(f"SCSS: {scss.relative_to(ROOT)}")
