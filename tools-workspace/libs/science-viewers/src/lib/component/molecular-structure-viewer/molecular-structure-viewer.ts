import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  MOLECULAR_ACCEPT_ATTR,
  MOLECULAR_FORMATS_HINT,
  MOLECULAR_FORMATS_LABEL,
  MOLECULAR_RELATED_TOOLS,
  MOLECULAR_SUPPORTED_EXTENSIONS
} from '../../constants/molecular-structure-viewer.constants';
import type { MolecularExportFormat, MolecularLoadedFile, MolecularStyle } from '../../types/molecular-structure-viewer.types';
import type { MoleculeAtom } from '../../types/molecule.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildMolecularMetadataRows,
  canExportMolecular,
  createMolecularFileRecord,
  createSampleMolecularFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportMolecularAtomsCsv,
  exportMolecularSummaryJson,
  filterValidMolecularFiles,
  formatMolecularFileSize,
  hitTestAtom,
  readMolecularFileBytes,
  renderMolecule,
  resolveMolecularSuggestion,
  CPK_COLORS
} from '../../utils/molecular-structure-viewer.utils';

@Component({
  selector: 'lib-molecular-structure-viewer',
  standalone: true,
  templateUrl: './molecular-structure-viewer.html',
  styleUrls: ['./molecular-structure-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MolecularStructureViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = MOLECULAR_ACCEPT_ATTR;
  readonly relatedTools = MOLECULAR_RELATED_TOOLS;
  readonly supportedExtensions = MOLECULAR_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = MOLECULAR_FORMATS_LABEL;
  readonly formatsHint = MOLECULAR_FORMATS_HINT;
  readonly styles: MolecularStyle[] = ['ball-stick', 'spacefill', 'wireframe'];
  readonly cpkColors = CPK_COLORS;

  files: MolecularLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  style: MolecularStyle = 'ball-stick';
  rotX = 0.35;
  rotY = 0.55;
  zoom = 1;
  showHydrogens = true;
  highlightAtom: number | null = null;
  hoverLabel = '';

  private dragDepth = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): MolecularLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportMolecular(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildMolecularMetadataRows(this.parsed) : [];
  }

  get elements(): Array<{ el: string; count: number; color: string }> {
    if (!this.parsed) return [];
    return Object.entries(this.parsed.elementCounts).map(([el, count]) => ({
      el,
      count,
      color: this.cpkColors[el] ?? '#cbd5e1'
    }));
  }

  get highlighted(): MoleculeAtom | null {
    if (this.highlightAtom == null || !this.parsed) return null;
    return this.parsed.atoms[this.highlightAtom] ?? null;
  }

  get primarySuggestion() {
    const s = resolveMolecularSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.showExportMenu) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isFileDrag(event)) return;
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) await this.handleFiles(Array.from(files));
    this.cdr.markForCheck();
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentFile || this.isTypingTarget(event.target)) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.rotY -= 0.12;
      this.renderCanvas();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.rotY += 0.12;
      this.renderCanvas();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.rotX -= 0.12;
      this.renderCanvas();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.rotX += 0.12;
      this.renderCanvas();
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.fitZoom();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      this.resetView();
    } else if (event.key.toLowerCase() === 'h') {
      event.preventDefault();
      this.toggleHydrogens();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomOut();
    }
  }

  trackByFileId(_index: number, file: MolecularLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByElement(_index: number, item: { el: string }): string {
    return item.el;
  }

  formatSize(bytes: number): string {
    return formatMolecularFileSize(bytes);
  }

  openFilePicker(): void {
    this.fileInput?.nativeElement?.click();
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    await this.handleFiles(Array.from(input.files));
    input.value = '';
  }

  async handleFiles(files: File[]): Promise<void> {
    const { accepted, rejected } = filterValidMolecularFiles(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();
    try {
      for (const file of accepted) {
        try {
          const bytes = await readMolecularFileBytes(file);
          const record = createMolecularFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid molecule file'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.warnings.length) this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleMolecularFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.highlightAtom = null;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  removeFile(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.files.length) return;
    const next = this.files.filter((_, i) => i !== index);
    this.files = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    this.currentIndex = Math.min(index, next.length - 1);
    this.renderCanvas();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.errorMessage = '';
    this.highlightAtom = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setStyle(style: MolecularStyle): void {
    this.style = style;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleHydrogens(): void {
    this.showHydrogens = !this.showHydrogens;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomIn(): void {
    this.zoom = Math.min(6, this.zoom * 1.15);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  zoomOut(): void {
    this.zoom = Math.max(0.2, this.zoom / 1.15);
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  fitZoom(): void {
    this.zoom = 1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  resetView(): void {
    this.rotX = 0.35;
    this.rotY = 0.55;
    this.zoom = 1;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: MolecularExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'chemical/x-mdl-molfile');
      else if (format === 'summary-json') downloadTextFile(exportMolecularSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'atoms-csv') downloadTextFile(exportMolecularAtomsCsv(file.parsed), `${file.name}.atoms.csv`, 'text/csv');
      else if (format === 'png') {
        const url = canvasToPngDataUrl(this.canvasHost.nativeElement);
        if (url) downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  onCanvasPointerDown(event: PointerEvent): void {
    this.dragging = true;
    this.lastX = event.clientX;
    this.lastY = event.clientY;
    (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  onCanvasPointerMove(event: PointerEvent): void {
    if (this.dragging) {
      const dx = event.clientX - this.lastX;
      const dy = event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.rotY += dx * 0.01;
      this.rotX += dy * 0.01;
      this.renderCanvas();
      return;
    }
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas || !parsed) return;
    const hit = hitTestAtom(parsed, canvas, event.clientX, event.clientY, {
      style: this.style,
      rotX: this.rotX,
      rotY: this.rotY,
      zoom: this.zoom,
      showHydrogens: this.showHydrogens,
      highlightAtom: this.highlightAtom,
      highlightResidue: null,
      chainFilter: null
    });
    this.highlightAtom = hit;
    const atom = hit != null ? parsed.atoms[hit] : null;
    this.hoverLabel = atom ? `${atom.element} ${atom.name} (#${atom.serial})` : '';
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onCanvasPointerUp(): void {
    this.dragging = false;
  }

  onCanvasWheel(event: WheelEvent): void {
    if (!this.parsed) return;
    event.preventDefault();
    if (event.deltaY < 0) this.zoomIn();
    else this.zoomOut();
  }

  private renderCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    const parsed = this.parsed;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    }
    if (!parsed) {
      this.clearCanvas();
      return;
    }
    renderMolecule(canvas, parsed, {
      style: this.style,
      rotX: this.rotX,
      rotY: this.rotY,
      zoom: this.zoom,
      showHydrogens: this.showHydrogens,
      highlightAtom: this.highlightAtom,
      highlightResidue: null,
      chainFilter: null
    });
  }

  private clearCanvas(): void {
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private observeCanvasResize(): void {
    const canvas = this.canvasHost?.nativeElement;
    const parent = canvas?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(parent);
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types?.includes('Files');
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName.toLowerCase();
    return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
  }
}
