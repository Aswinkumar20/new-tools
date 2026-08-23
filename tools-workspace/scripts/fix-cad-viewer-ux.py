#!/usr/bin/env python3
"""Fix leftover CAD UX patch issues: HTML wrappers, search row, pick expressions."""

from __future__ import annotations

import re
from pathlib import Path

COMP = Path(__file__).resolve().parents[1] / "libs" / "cad-viewers" / "src" / "lib" / "component"

BROKEN_DIV = """        <div class="ctl__panel">
        <div class="ctl__panel" *ngIf="parsed && !hasSelection">"""
FIXED_DIV = """        <div class="ctl__panel" *ngIf="parsed && !hasSelection">"""

PICK_FIXES = {
    "building-floor-plan-viewer.ts": (
        "pickCadEntityAtScreen(solids, this.view, canvas.height, sx, sy)",
        "pickCadEntityAtScreen(toFpCadGeom(this.visibleSpaces), this.view, canvas.height, sx, sy)",
    ),
    "gdsii-layout-viewer.ts": (
        "    const id = pickCadEntityAtScreen(toGdFeatGeom(this.visibleFeatures), this.view, canvas.height, sx, sy);\n    if (id) this.clearSelection();",
        "    const id = pickCadEntityAtScreen(toGdFeatGeom(this.visibleFeatures), this.view, canvas.height, sx, sy);\n    if (id) this.selectFeat(id);\n    else this.clearSelection();",
    ),
    "eagle-pcb-viewer.ts": (
        "    const id = pickCadEntityAtScreen(geom, this.view, canvas.height, sx, sy);\n    if (id) this.clearSelection();",
        "    const geom = this.viewMode === 'schematic' ? toEgSchGeom(this.filteredSchItems) : toEgBoardGeom(this.visibleBoardItems);\n"
        "    const id = pickCadEntityAtScreen(geom, this.view, canvas.height, sx, sy);\n"
        "    if (!id) this.clearSelection();\n"
        "    else if (this.viewMode === 'schematic') this.selectSch(id);\n"
        "    else this.selectBoard(id);",
    ),
    "kicad-viewer.ts": (
        "    const id = pickCadEntityAtScreen(geom, this.view, canvas.height, sx, sy);\n    if (id) this.clearSelection();",
        "    const geom = this.viewMode === 'schematic' ? toKcSchGeom(this.filteredSchItems) : toKcBoardGeom(this.visibleBoardItems);\n"
        "    const id = pickCadEntityAtScreen(geom, this.view, canvas.height, sx, sy);\n"
        "    if (!id) this.clearSelection();\n"
        "    else if (this.viewMode === 'schematic') this.selectSch(id);\n"
        "    else this.selectBoard(id);",
    ),
    "altium-pcb-viewer.ts": (
        "    const id = pickCadEntityAtScreen(geom, this.view, canvas.height, sx, sy);\n    if (id) this.selectCopper(id);\n    else this.clearSelection();",
        "    const geom = this.viewMode === 'designators' ? toAlDesGeom(this.filteredDesignators) : toAlCopperGeom(this.visibleCoppers);\n"
        "    const id = pickCadEntityAtScreen(geom, this.view, canvas.height, sx, sy);\n"
        "    if (!id) this.clearSelection();\n"
        "    else if (this.viewMode === 'designators') this.selectDes(id);\n"
        "    else this.selectCopper(id);",
    ),
}

ASSEMBLY = {
    "catia-viewer.ts": "this.viewMode === 'preview' ? toCad3dInstances(this.visibleParts, this.filteredInstances) : toCad3dParts(this.visibleParts)",
    "solidworks-viewer.ts": "this.viewMode === 'preview' ? toCad3dInstances(this.visibleParts, this.filteredInstances) : toCad3dParts(this.visibleParts)",
    "inventor-viewer.ts": "this.viewMode === 'preview' ? toCad3dInstances(this.visibleParts, this.filteredInstances) : toCad3dParts(this.visibleParts)",
    "creo-viewer.ts": "this.viewMode === 'preview' ? toCad3dInstances(this.visibleParts, this.filteredInstances) : toCad3dParts(this.visibleParts)",
    "fusion-360-viewer.ts": "this.viewMode === 'preview' ? toCad3dInstances(this.visibleBodies, this.filteredInstances) : toCad3dBodies(this.visibleBodies)",
    "sketchup-viewer.ts": "this.viewMode === 'preview' ? toCad3dInstances(this.visibleGroups, this.filteredInstances) : toCad3dGroups(this.visibleGroups)",
    "rhino-3dm-viewer.ts": "this.viewMode === 'preview' ? toCad3dInstances(this.visibleSurfaces, this.filteredInstances) : toCad3dSurfaces(this.visibleSurfaces)",
}


def wrap_search(html: str, prefix: str) -> str:
    if f"{prefix}-search-row" in html:
        return html
    pattern = re.compile(
        rf'(<div class="ctl__panel-body">\s*)(<input #searchInput class="{prefix}-search" type="search"[^>]*>)',
        re.M,
    )
    return pattern.sub(
        rf'\1<div class="{prefix}-search-row">\n              \2\n'
        rf'              <button type="button" class="ctl__tool-btn" *ngIf="query" (click)="clearSearch()" aria-label="Clear search">Clear</button>\n'
        rf"            </div>",
        html,
        count=1,
    )


def main() -> None:
    changed = []
    for folder in sorted(COMP.iterdir()):
        if not folder.is_dir():
            continue
        for html_path in folder.glob("*.html"):
            html = html_path.read_text()
            orig = html
            html = html.replace(BROKEN_DIV, FIXED_DIV)
            prefix_m = re.search(r'class="ctl ([a-z]{2})', html)
            if prefix_m:
                html = wrap_search(html, prefix_m.group(1))
            if html != orig:
                html_path.write_text(html)
                changed.append(str(html_path.name))
        for ts_path in folder.glob("*.ts"):
            if ts_path.name.endswith(".spec.ts"):
                continue
            ts = ts_path.read_text()
            orig = ts
            if ts_path.name in PICK_FIXES:
                old, new = PICK_FIXES[ts_path.name]
                ts = ts.replace(old, new)
            if ts_path.name in ASSEMBLY:
                ts = ts.replace(
                    "pickCad3dSolidAtScreen(solids, this.view, canvas.width, canvas.height, sx, sy)",
                    f"pickCad3dSolidAtScreen({ASSEMBLY[ts_path.name]}, this.view, canvas.width, canvas.height, sx, sy)",
                )
            if ts != orig:
                ts_path.write_text(ts)
                changed.append(str(ts_path.name))
    print(f"Fixed {len(changed)} files")
    for name in changed:
        print(f"  {name}")


if __name__ == "__main__":
    main()
