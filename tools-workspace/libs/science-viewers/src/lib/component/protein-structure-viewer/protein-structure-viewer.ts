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
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService } from '@tools-workspace/features-home';
import {
  PROTEIN_ACCEPT_ATTR,
  PROTEIN_FORMATS_HINT,
  PROTEIN_FORMATS_LABEL,
  PROTEIN_RELATED_TOOLS,
  PROTEIN_SUPPORTED_EXTENSIONS
} from '../../constants/protein-structure-viewer.constants';
import type { ProteinExportFormat, ProteinLoadedFile, ProteinStyle } from '../../types/protein-structure-viewer.types';
import type { MoleculeResidue } from '../../types/molecule.types';
import { canvasToPngDataUrl } from '../../utils/science-image-render.utils';
import {
  buildProteinMetadataRows,
  canExportProtein,
  createProteinFileRecord,
  createSampleProteinFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportProteinResiduesCsv,
  exportProteinSummaryJson,
  filterResidues,
  filterValidProteinFiles,
  formatProteinFileSize,
  hitTestAtom,
  readProteinFileBytes,
  renderMolecule,
  resolveProteinSuggestion,
  SS_COLORS
} from '../../utils/protein-structure-viewer.utils';

@Component({
  selector: 'lib-protein-structure-viewer',
  standalone: true,
  templateUrl: './protein-structure-viewer.html',
  styleUrls: ['./protein-structure-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProteinStructureViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost!: ElementRef<HTMLCanvasElement>;

  readonly acceptAttr = PROTEIN_ACCEPT_ATTR;
  readonly relatedTools = PROTEIN_RELATED_TOOLS;
  readonly supportedExtensions = PROTEIN_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PROTEIN_FORMATS_LABEL;
  readonly formatsHint = PROTEIN_FORMATS_HINT;
  readonly styles: ProteinStyle[] = ['ribbon', 'backbone', 'ball-stick', 'spacefill'];
  readonly ssColors = SS_COLORS;

  files: ProteinLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  style: ProteinStyle = 'ribbon';
  rotX = 0.4;
  rotY = 0.7;
  zoom = 1;
  showHydrogens = false;
  showHetero = true;
  chainFilter: string | null = null;
  residueQuery = '';
  highlightResidue: string | null = null;
  highlightAtom: number | null = null;
  hoverLabel = '';

  private dragDepth = 0;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): ProteinLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportProtein(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildProteinMetadataRows(this.parsed) : [];
  }

  get chains() {
    return this.parsed?.chains ?? [];
  }

  get visibleResidues(): MoleculeResidue[] {
    if (!this.parsed) return [];
    return filterResidues(this.parsed.residues, this.residueQuery, this.chainFilter);
  }

  get sequence(): string {
    if (!this.parsed) return '';
    if (this.chainFilter) {
      return this.parsed.chains.find((c) => c.id === this.chainFilter)?.sequence ?? '';
    }
    return this.parsed.chains.map((c) => `${c.id}:${c.sequence}`).join(' · ');
  }

  get selectedResidue(): MoleculeResidue | null {
    if (!this.parsed || !this.highlightResidue) return null;
    return this.parsed.residues.find((r) => r.id === this.highlightResidue) ?? null;
  }

  get primarySuggestion() {
    const s = resolveProteinSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
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
    } else if (event.key.toLowerCase() === 'e') {
      event.preventDefault();
      this.toggleHetero();
    } else if (event.key === '/' ) {
      event.preventDefault();
      const input = document.querySelector<HTMLInputElement>('.prot-search');
      input?.focus();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      this.zoomIn();
    } else if (event.key === '-') {
      event.preventDefault();
      this.zoomOut();
    }
  }

  trackByFileId(_index: number, file: ProteinLoadedFile): string {
    return file.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  trackByResidue(_index: number, residue: MoleculeResidue): string {
    return residue.id;
  }

  trackByChain(_index: number, chain: { id: string }): string {
    return chain.id;
  }

  formatSize(bytes: number): string {
    return formatProteinFileSize(bytes);
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
    const { accepted, rejected } = filterValidProteinFiles(files);
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
          const bytes = await readProteinFileBytes(file);
          const record = createProteinFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
          this.chainFilter = null;
          this.highlightResidue = null;
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid PDB'}`;
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
    await this.handleFiles([createSampleProteinFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.chainFilter = null;
    this.highlightResidue = null;
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
    this.highlightResidue = null;
    this.highlightAtom = null;
    this.chainFilter = null;
    this.residueQuery = '';
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

  setStyle(style: ProteinStyle): void {
    this.style = style;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  setChain(chainId: string | null): void {
    this.chainFilter = chainId;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleHydrogens(): void {
    this.showHydrogens = !this.showHydrogens;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  toggleHetero(): void {
    this.showHetero = !this.showHetero;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onResidueQueryChange(): void {
    this.cdr.markForCheck();
  }

  selectResidue(residue: MoleculeResidue): void {
    this.highlightResidue = residue.id;
    this.highlightAtom = residue.caIndex;
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
    this.rotX = 0.4;
    this.rotY = 0.7;
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

  exportAs(format: ProteinExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(new TextEncoder().encode(file.text), file.name, 'chemical/x-pdb');
      else if (format === 'summary-json') downloadTextFile(exportProteinSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'residues-csv') downloadTextFile(exportProteinResiduesCsv(file.parsed), `${file.name}.residues.csv`, 'text/csv');
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
      showHetero: this.showHetero,
      highlightAtom: this.highlightAtom,
      highlightResidue: this.highlightResidue,
      chainFilter: this.chainFilter
    });
    this.highlightAtom = hit;
    const atom = hit != null ? parsed.atoms[hit] : null;
    if (atom) {
      this.highlightResidue = `${atom.chainId}:${atom.residueSeq}:${atom.residueName}`;
      this.hoverLabel = `${atom.residueName} ${atom.residueSeq}${atom.chainId} · ${atom.name}`;
    } else {
      this.hoverLabel = '';
    }
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
      showHetero: this.showHetero,
      highlightAtom: this.highlightAtom,
      highlightResidue: this.highlightResidue,
      chainFilter: this.chainFilter
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
