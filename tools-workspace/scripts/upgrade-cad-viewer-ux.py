#!/usr/bin/env python3
"""Apply shared CAD viewer UX (viewport, toolbar, pick, a11y) to all cad-viewers except DWG."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "libs" / "cad-viewers" / "src" / "lib"
COMP = ROOT / "component"
UTILS = ROOT / "utils"
SKIP = {"dwg-viewer"}

SELECT_PRIORITY = [
    "selectEntity",
    "selectFeature",
    "selectElement",
    "selectSolid",
    "selectInstance",
    "selectItem",
    "selectMember",
    "selectSpace",
    "selectTrace",
    "selectCopper",
    "selectBoardItem",
    "selectCommand",
    "selectProduct",
]


def patch_utils(path: Path) -> bool:
    text = path.read_text()
    orig = text
    if "sizeCadCanvas" not in text:
        text = text.replace(
            "  downloadTextFile,\n  fitCadView,\n",
            "  downloadTextFile,\n  fitCadView,\n  pickCadEntityAtScreen,\n  sizeCadCanvas,\n",
        )
        text = text.replace(
            "  downloadTextFile,\n  formatCadFileSize",
            "  downloadTextFile,\n  sizeCadCanvas,\n  formatCadFileSize",
        )
    if "fitCad3dView" in text and "pickCad3dSolidAtScreen" not in text:
        text = text.replace(
            "export { defaultCad3dView, fitCad3dView } from './cad-3d.utils';",
            "export { defaultCad3dView, fitCad3dView, pickCad3dSolidAtScreen } from './cad-3d.utils';",
        )
    if text != orig:
        path.write_text(text)
        return True
    return False


def patch_scss(path: Path) -> bool:
    text = path.read_text()
    orig = text
    if "cad-viewer-shell" not in text:
        text = text.replace(
            "@use '../../../../../../apps/tools-site/src/app/compact-tool-layout.scss';\n",
            "@use '../../../../../../apps/tools-site/src/app/compact-tool-layout.scss';\n@use '../../styles/cad-viewer-shell';\n",
        )
    text = re.sub(r"min-height:\s*28rem;\s*background:\s*#0f172a;\s*overflow:\s*auto;", "min-height: 16rem; background: #0f172a; overflow: hidden;", text)
    text = re.sub(r"width:\s*100%;\s*height:\s*18rem;", "width: 100%; height: auto; min-height: 16rem;", text)
    if text != orig:
        path.write_text(text)
        return True
    return False


def detect_prefix(html: str) -> str | None:
    m = re.search(r'<div class="ctl ([a-z]{2})(?: cad-shell)?">', html)
    return m.group(1) if m else None


def patch_html(path: Path) -> bool:
    html = path.read_text()
    orig = html
    prefix = detect_prefix(html)
    if not prefix:
        return False
    if "cad-shell" not in html:
        html = html.replace(f'<div class="ctl {prefix}">', f'<div class="ctl {prefix} cad-shell">')
    html = html.replace(f'<section class="{prefix}-panel">', f'<section class="{prefix}-panel" #viewerPanel>')
    html = re.sub(
        r'<div class="[a-z]{2}-tab-bar" \*ngIf="currentFile" role="tablist">\n(\s*)<button type="button" role="tab" \*ngFor="let mode of viewModes" \[class\.is-active\]="viewMode === mode\.id" \(click\)="setViewMode\(mode\.id\)">',
        lambda m: m.group(0).replace(
            '[class.is-active]="viewMode === mode.id" (click)="setViewMode(mode.id)"',
            '[class.is-active]="viewMode === mode.id" [attr.aria-selected]="viewMode === mode.id" (click)="setViewMode(mode.id)"',
        ),
        html,
        count=1,
    )
    html = html.replace(
        f'<button type="button" class="{prefix}-files__remove" (click)="removeFile(i, $event)">×</button>',
        f'<button type="button" class="{prefix}-files__remove" (click)="removeFile(i, $event)" [attr.aria-label]="\'Remove \' + file.name">×</button>',
    )
    html = html.replace('(pointerup)="onCanvasPointerUp()"', '(pointerup)="onCanvasPointerUp($event)"')
    html = html.replace('(pointerleave)="onCanvasPointerUp()"', '(pointerleave)="onCanvasPointerUp($event)"')

    hint = (
        f'            <p class="{prefix}-view-hint" *ngIf="viewMode !== \'table\'">'
        f'Drag to {"rotate" if "--rotating" in orig or "rotating" in orig else "pan"} · click to select · wheel zoom · <kbd>0</kbd> fit</p>\n'
    )
    if f"{prefix}-view-hint" not in html:
        html = re.sub(
            rf'(<header class="{prefix}-map-head" \*ngIf="currentFile">\s*<div>\s*<strong>\{{{{ currentFile\.name \}}}}</strong>\s*<span>.*?</span>\n)',
            rf"\1{hint}",
            html,
            count=1,
            flags=re.S,
        )

    isolate_btn = ""
    if "hiddenLayerIds" in (path.with_suffix(".ts")).read_text():
        isolate_btn = (
            f'            <button type="button" *ngIf="viewMode !== \'table\'" (click)="isolateSelected()" [disabled]="!selectedLayerId" aria-label="Isolate selected layer" appTooltip="Isolate selected layer">Isolate</button>\n'
            f'            <button type="button" *ngIf="viewMode !== \'table\'" (click)="showAllLayers()" [disabled]="!hiddenLayerIds.size" aria-label="Show all layers" appTooltip="Show all layers">Show all</button>\n'
        )
    controls = (
        f'          <div class="{prefix}-view-controls" role="group" aria-label="View controls">\n'
        f'            <button type="button" *ngIf="viewMode !== \'table\'" (click)="zoomBy(1 / 1.2)" aria-label="Zoom out" appTooltip="Zoom out">−</button>\n'
        f'            <button type="button" *ngIf="viewMode !== \'table\'" (click)="zoomBy(1.2)" aria-label="Zoom in" appTooltip="Zoom in">+</button>\n'
        f'            <button type="button" *ngIf="viewMode !== \'table\'" (click)="fitView()" aria-label="Fit model to view" appTooltip="Fit view">Fit</button>\n'
        f'            <button type="button" *ngIf="viewMode !== \'table\'" (click)="resetView()" aria-label="Reset view" appTooltip="Reset view">Reset</button>\n'
        f"{isolate_btn}"
        f'            <button type="button" (click)="clearSelection()" [disabled]="!hasSelection" aria-label="Clear selection" appTooltip="Clear selection">Deselect</button>\n'
        f'            <button type="button" *ngIf="viewMode !== \'table\'" (click)="toggleFullscreen()" aria-label="Toggle fullscreen" appTooltip="Fullscreen">{{{{ isFullscreen ? \'Exit\' : \'Full\' }}}}</button>\n'
        f'            <button type="button" (click)="toggleSidebar()" [attr.aria-pressed]="!sidebarCollapsed" aria-label="Toggle properties panel" appTooltip="Toggle side panel">Panel</button>\n'
        f"          </div>"
    )
    html = re.sub(
        rf'          <div class="{prefix}-view-controls">\s*'
        rf'<button type="button" \*ngIf="viewMode !== \'table\'" \(click\)="fitView\(\)">Fit</button>\s*'
        rf'<button type="button" \(click\)="toggleSidebar\(\)">Panel</button>\s*'
        rf"</div>",
        controls,
        html,
        count=1,
    )

    html = re.sub(
        rf'<aside class="{prefix}-sidebar">',
        rf'<aside class="{prefix}-sidebar" *ngIf="!sidebarCollapsed">',
        html,
        count=1,
    )
    if f"{prefix}-empty-panel" not in html and f'<aside class="{prefix}-sidebar"' in html:
        html = html.replace(
            f'<aside class="{prefix}-sidebar" *ngIf="!sidebarCollapsed">\n        <div class="ctl__panel" *ngIf="parsed">',
            f'<aside class="{prefix}-sidebar" *ngIf="!sidebarCollapsed">\n'
            f'        <div class="ctl__panel" *ngIf="!parsed">\n'
            f'          <header class="ctl__panel-head">Get started</header>\n'
            f'          <div class="ctl__panel-body">\n'
            f'            <p class="{prefix}-empty-panel">Upload a file or load the sample to inspect the model here.</p>\n'
            f"          </div>\n"
            f"        </div>\n"
            f'        <div class="ctl__panel" *ngIf="parsed">',
        )
        html = html.replace(
            '          <header class="ctl__panel-head">Related tools</header>',
            f'        <div class="ctl__panel" *ngIf="parsed && !hasSelection">\n'
            f'          <header class="ctl__panel-head">Selection</header>\n'
            f'          <div class="ctl__panel-body">\n'
            f'            <p class="{prefix}-empty-panel">Click the model or a tree item to inspect properties.</p>\n'
            f"          </div>\n"
            f"        </div>\n"
            f'        <div class="ctl__panel">\n'
            f'          <header class="ctl__panel-head">Related tools</header>',
        )

    search_re = re.compile(
        rf'(<div class="ctl__panel-body">\n\s*)(<input #searchInput class="{prefix}-search" type="search"[^/]*/>)',
    )
    if f"{prefix}-search-row" not in html:
        html = search_re.sub(
            rf'\1<div class="{prefix}-search-row">\n              \2\n'
            rf'              <button type="button" class="ctl__tool-btn" *ngIf="query" (click)="clearSearch()" aria-label="Clear search">Clear</button>\n'
            rf"            </div>",
            html,
            count=1,
        )

    if html != orig:
        path.write_text(html)
        return True
    return False


def pick_select_fn(ts: str) -> str | None:
    for name in SELECT_PRIORITY:
        if f"{name}(" in ts:
            return name
    return None


def selected_id_fields(ts: str) -> list[str]:
    fields = sorted(set(re.findall(r"\b(selected\w+Id)\s*=", ts)))
    return [f for f in fields if f.startswith("selected")]


def geom_expr(ts: str, is_3d: bool) -> str:
    if is_3d:
        m = re.search(r"const solids = ([^;]+);\s*\n\s*this\.view = fitCad3dView\(solids", ts)
        if m:
            return m.group(1).strip()
        m = re.search(r"this\.view = fitCad3dView\((.+), width, height\)", ts)
        if m:
            return m.group(1).strip()
        return "[]"
    m = re.search(r"this\.view = fitCadView\((.+), width, height\)", ts)
    return m.group(1).strip() if m else "[]"


def patch_ts(path: Path) -> bool:
    ts = path.read_text()
    orig = ts
    is_3d = "rotating" in ts and "Cad3dView" in ts
    drag_flag = "rotating" if is_3d else "panning"

    if "sizeCadCanvas" not in ts:
        if is_3d and "fitCad3dView," in ts:
            ts = ts.replace("  fitCad3dView,\n", "  fitCad3dView,\n  pickCad3dSolidAtScreen,\n  sizeCadCanvas,\n")
        elif "fitCadView," in ts:
            ts = ts.replace("  fitCadView,\n", "  fitCadView,\n  pickCadEntityAtScreen,\n  sizeCadCanvas,\n")
        elif "fitCad3dView," in ts:
            ts = ts.replace("  fitCad3dView,\n", "  fitCad3dView,\n  pickCad3dSolidAtScreen,\n  sizeCadCanvas,\n")

    if "@ViewChild('viewerPanel')" not in ts:
        ts = ts.replace(
            "  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;\n",
            "  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;\n"
            "  @ViewChild('viewerPanel') viewerPanel?: ElementRef<HTMLElement>;\n",
        )

    if "isFullscreen" not in ts:
        ts = ts.replace(f"  {drag_flag} = false;\n", f"  {drag_flag} = false;\n  isFullscreen = false;\n")
    if "pointerMoved" not in ts:
        ts = ts.replace("  private lastY = 0;\n", "  private lastY = 0;\n  private pointerMoved = 0;\n")

    fields = selected_id_fields(ts)
    has_sel_expr = " || ".join(f"this.{f}" for f in fields) if fields else "false"
    if "get hasSelection()" not in ts:
        insert_at = re.search(r"  get primarySuggestion\(\)", ts)
        getter = (
            f"  get hasSelection(): boolean {{\n    return !!({has_sel_expr});\n  }}\n\n"
        )
        if insert_at:
            ts = ts[: insert_at.start()] + getter + ts[insert_at.start() :]

    if "onFullscreenChange" not in ts:
        ts = ts.replace(
            "  ngOnDestroy(): void {\n    this.resizeObserver?.disconnect();\n  }\n",
            "  ngOnDestroy(): void {\n    this.resizeObserver?.disconnect();\n  }\n\n"
            "  @HostListener('document:fullscreenchange')\n"
            "  onFullscreenChange(): void {\n"
            "    this.isFullscreen = !!document.fullscreenElement;\n"
            "    this.cdr.markForCheck();\n"
            "    setTimeout(() => this.renderCanvas(), 0);\n"
            "  }\n",
        )

    if "event.key === '0'" not in ts:
        ts = ts.replace(
            "    if (!this.parsed) return;\n    if (event.key === '/') {\n",
            "    if (!this.parsed) return;\n"
            "    if (event.key === 'Escape') {\n"
            "      event.preventDefault();\n"
            "      if (this.isFullscreen) void document.exitFullscreen?.();\n"
            "      else this.clearSelection();\n"
            "    } else if (event.key === '0') {\n"
            "      event.preventDefault();\n"
            "      this.fitView();\n"
            "    } else if (event.key === '+' || event.key === '=') {\n"
            "      event.preventDefault();\n"
            "      this.zoomBy(1.2);\n"
            "    } else if (event.key === '-') {\n"
            "      event.preventDefault();\n"
            "      this.zoomBy(1 / 1.2);\n"
            "    } else if (event.key === '/') {\n",
        )

    ts = re.sub(
        r"    const parent = canvas\.parentElement;\n"
        r"    const width = parent \? Math\.max\(320, parent\.clientWidth\) : canvas\.width \|\| 640;\n"
        r"    const height = parent \? Math\.max\(220, Math\.min\(360, parent\.clientHeight \|\| 320\)\) : canvas\.height \|\| 320;\n",
        "    const { width, height } = sizeCadCanvas(canvas);\n",
        ts,
    )
    ts = re.sub(
        r"    const parent = canvas\.parentElement;\n"
        r"    if \(parent\) \{\n"
        r"      canvas\.width = Math\.max\(320, parent\.clientWidth\);\n"
        r"      canvas\.height = Math\.max\(220, Math\.min\(360, parent\.clientHeight \|\| 320\)\);\n"
        r"    \}\n",
        "    sizeCadCanvas(canvas);\n",
        ts,
    )

    select_fn = pick_select_fn(ts)
    geom = geom_expr(ts, is_3d)
    pick_call = (
        f"pickCad3dSolidAtScreen({geom}, this.view, canvas.width, canvas.height, sx, sy)"
        if is_3d
        else f"pickCadEntityAtScreen({geom}, this.view, canvas.height, sx, sy)"
    )
    select_line = f"    if (id) this.{select_fn}(id);\n    else this.clearSelection();\n" if select_fn else "    if (id) this.clearSelection();\n"

    if is_3d:
        move_body = (
            "    this.view = {\n"
            "      ...this.view,\n"
            "      rotY: this.view.rotY + dx * 0.01,\n"
            "      rotX: Math.max(-1.4, Math.min(1.4, this.view.rotX + dy * 0.01))\n"
            "    };\n"
        )
        zoom_method = (
            "  zoomBy(factor: number): void {\n"
            "    if (!this.parsed || this.viewMode === 'table') return;\n"
            "    this.view = { ...this.view, zoom: Math.max(0.08, Math.min(12, this.view.zoom * factor)) };\n"
            "    this.renderCanvas();\n"
            "    this.cdr.markForCheck();\n"
            "  }\n\n"
            "  resetView(): void {\n"
            "    this.view = defaultCad3dView();\n"
            "    this.fitView();\n"
            "  }\n\n"
        )
    else:
        move_body = (
            "    this.view = { ...this.view, offsetX: this.view.offsetX + dx, offsetY: this.view.offsetY - dy };\n"
        )
        zoom_method = (
            "  zoomBy(factor: number): void {\n"
            "    const canvas = this.canvasHost?.nativeElement;\n"
            "    if (!canvas || !this.parsed || this.viewMode === 'table') return;\n"
            "    const sx = canvas.width / 2;\n"
            "    const sy = canvas.height / 2;\n"
            "    const next = Math.max(0.05, Math.min(80, this.view.scale * factor));\n"
            "    const applied = next / this.view.scale;\n"
            "    this.view = {\n"
            "      scale: next,\n"
            "      offsetX: sx * (1 - applied) + this.view.offsetX * applied,\n"
            "      offsetY: (canvas.height - sy) * (1 - applied) + this.view.offsetY * applied\n"
            "    };\n"
            "    this.renderCanvas();\n"
            "    this.cdr.markForCheck();\n"
            "  }\n\n"
            "  resetView(): void {\n"
            "    this.fitView();\n"
            "  }\n\n"
        )

    pointer_block = (
        f"  onCanvasPointerDown(event: PointerEvent): void {{\n"
        f"    this.{drag_flag} = true;\n"
        f"    this.pointerMoved = 0;\n"
        f"    this.lastX = event.clientX;\n"
        f"    this.lastY = event.clientY;\n"
        f"    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);\n"
        f"  }}\n\n"
        f"  onCanvasPointerMove(event: PointerEvent): void {{\n"
        f"    if (!this.{drag_flag}) return;\n"
        f"    const dx = event.clientX - this.lastX;\n"
        f"    const dy = event.clientY - this.lastY;\n"
        f"    this.pointerMoved += Math.abs(dx) + Math.abs(dy);\n"
        f"    this.lastX = event.clientX;\n"
        f"    this.lastY = event.clientY;\n"
        f"{move_body}"
        f"    this.renderCanvas();\n"
        f"  }}\n\n"
        f"  onCanvasPointerUp(event?: PointerEvent): void {{\n"
        f"    const wasClick = this.{drag_flag} && this.pointerMoved <= 8;\n"
        f"    this.{drag_flag} = false;\n"
        f"    if (!wasClick || !event || !this.parsed || this.viewMode === 'table') return;\n"
        f"    const canvas = this.canvasHost?.nativeElement;\n"
        f"    if (!canvas) return;\n"
        f"    const rect = canvas.getBoundingClientRect();\n"
        f"    if (!rect.width || !rect.height) return;\n"
        f"    const sx = ((event.clientX - rect.left) * canvas.width) / rect.width;\n"
        f"    const sy = ((event.clientY - rect.top) * canvas.height) / rect.height;\n"
        f"    const id = {pick_call};\n"
        f"{select_line}"
        f"  }}\n"
    )

    ts = re.sub(
        r"  onCanvasPointerDown\(event: PointerEvent\): void \{.*?\n  onCanvasPointerUp\(\): void \{\n    this\.(?:panning|rotating) = false;\n  \}\n",
        pointer_block + "\n",
        ts,
        count=1,
        flags=re.S,
    )

    extra_methods = zoom_method + (
        "  async toggleFullscreen(): Promise<void> {\n"
        "    const host = this.viewerPanel?.nativeElement;\n"
        "    if (!host) return;\n"
        "    try {\n"
        "      if (!document.fullscreenElement) await host.requestFullscreen();\n"
        "      else await document.exitFullscreen();\n"
        "    } catch {\n"
        "      this.toast.info('Fullscreen is not available in this browser');\n"
        "    }\n"
        "  }\n\n"
        "  clearSearch(): void {\n"
        "    this.query = '';\n"
        "    this.onFilterChange();\n"
        "  }\n\n"
        "  clearSelection(): void {\n"
        + "".join(f"    this.{f} = '';\n" for f in fields)
        + ("    this.selectedRowIndex = -1;\n" if "selectedRowIndex" in ts else "")
        + "    this.renderCanvas();\n"
        + "    this.cdr.markForCheck();\n"
        + "  }\n\n"
    )
    if "hiddenLayerIds" in ts and "isolateSelected(" not in ts:
        extra_methods += (
            "  isolateSelected(): void {\n"
            "    if (!this.selectedLayerId || !this.parsed) return;\n"
            "    const layers = (this.parsed as { layers?: Array<{ id: string }> }).layers ?? [];\n"
            "    this.hiddenLayerIds = new Set(layers.filter((l) => l.id !== this.selectedLayerId).map((l) => l.id));\n"
            "    this.renderCanvas();\n"
            "    this.cdr.markForCheck();\n"
            "  }\n\n"
            "  showAllLayers(): void {\n"
            "    this.hiddenLayerIds = new Set();\n"
            "    this.renderCanvas();\n"
            "    this.cdr.markForCheck();\n"
            "  }\n\n"
        )

    if "zoomBy(factor" not in ts:
        ts = ts.replace("  fitView(): void {", extra_methods + "  fitView(): void {")

    if ts != orig:
        path.write_text(ts)
        return True
    return False


def main() -> None:
    changed = []
    for utils in sorted(UTILS.glob("*viewer.utils.ts")):
        if utils.name.startswith("dwg-"):
            continue
        if patch_utils(utils):
            changed.append(str(utils.relative_to(ROOT)))
    for folder in sorted(COMP.iterdir()):
        if not folder.is_dir() or folder.name in SKIP:
            continue
        for scss in folder.glob("*.scss"):
            if patch_scss(scss):
                changed.append(str(scss.relative_to(ROOT)))
        for html in folder.glob("*.html"):
            if patch_html(html):
                changed.append(str(html.relative_to(ROOT)))
        for ts in folder.glob("*.ts"):
            if ts.name.endswith(".spec.ts"):
                continue
            if patch_ts(ts):
                changed.append(str(ts.relative_to(ROOT)))
    print(f"Updated {len(changed)} files")
    for item in changed:
        print(f"  {item}")


if __name__ == "__main__":
    main()
