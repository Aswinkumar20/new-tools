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
import { AssetService, Navigation, StatValueTooltipHostDirective, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { buildDiagramInsightStats } from '../../utils/diagram-file.utils';
import {
  OWL_ACCEPT_ATTR,
  OWL_FORMATS_HINT,
  OWL_FORMATS_LABEL,
  OWL_RELATED_TOOLS,
  OWL_SUPPORTED_EXTENSIONS
} from '../../constants/owl-ontology-viewer.constants';
import type {
  OwlAxiom,
  OwlClass,
  OwlExportFormat,
  OwlLoadedFile,
  OwlProperty,
  OwlViewMode
} from '../../types/owl-ontology-viewer.types';
import {
  buildOwlAxiomMetadata,
  buildOwlClassMetadata,
  buildOwlMetadataRows,
  buildOwlPropertyMetadata,
  canExportOwl,
  canvasToPngDataUrl,
  createOwlFileRecord,
  createSampleOwlFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportOwlClassesCsv,
  exportOwlPropertiesCsv,
  exportOwlSummaryJson,
  filterOwlAxioms,
  filterOwlClasses,
  filterOwlProperties,
  filterValidOwlFiles,
  formatOwlFileSize,
  owlNodeColor,
  readOwlFileBytes,
  renderOwlAxioms,
  renderOwlClasses,
  renderOwlDiagram,
  renderOwlProperties,
  resolveOwlSuggestion
} from '../../utils/owl-ontology-viewer.utils';

@Component({
  selector: 'lib-owl-ontology-viewer',
  standalone: true,
  templateUrl: './owl-ontology-viewer.html',
  styleUrls: ['./owl-ontology-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OwlOntologyViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = OWL_ACCEPT_ATTR;
  readonly relatedTools = OWL_RELATED_TOOLS;
  readonly supportedExtensions = OWL_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = OWL_FORMATS_LABEL;
  readonly formatsHint = OWL_FORMATS_HINT;
  readonly viewModes: Array<{ id: OwlViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'classes', label: 'Classes' },
    { id: 'properties', label: 'Properties' },
    { id: 'table', label: 'Table' }
  ];

  files: OwlLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: OwlViewMode = 'diagram';
  query = '';
  selectedClassId = '';
  selectedPropertyId = '';
  selectedAxiomId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  get currentFile(): OwlLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportOwl(this.currentFile);
  }

  get insights() {
    return buildDiagramInsightStats(
      this.parsed as Record<string, unknown> | null,
      this.files.length,
      this.currentFile?.size ?? null,
      this.warnings,
      (n) => this.formatSize(n)
    );
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get selectedClass(): OwlClass | null {
    return this.parsed?.classes.find((c) => c.id === this.selectedClassId) ?? null;
  }

  get selectedProperty(): OwlProperty | null {
    return this.parsed?.properties.find((p) => p.id === this.selectedPropertyId) ?? null;
  }

  get selectedAxiom(): OwlAxiom | null {
    return this.parsed?.axioms.find((a) => a.id === this.selectedAxiomId) ?? null;
  }

  get filteredClasses(): OwlClass[] {
    return this.parsed ? filterOwlClasses(this.parsed.classes, this.query) : [];
  }

  get filteredProperties(): OwlProperty[] {
    return this.parsed ? filterOwlProperties(this.parsed.properties, this.query) : [];
  }

  get filteredAxioms(): OwlAxiom[] {
    return this.parsed ? filterOwlAxioms(this.parsed.axioms, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildOwlMetadataRows(this.parsed) : [];
  }

  get classMetadataRows() {
    return this.selectedClass ? buildOwlClassMetadata(this.selectedClass) : [];
  }

  get propertyMetadataRows() {
    return this.selectedProperty ? buildOwlPropertyMetadata(this.selectedProperty) : [];
  }

  get axiomMetadataRows() {
    return this.selectedAxiom ? buildOwlAxiomMetadata(this.selectedAxiom) : [];
  }

  get primarySuggestion() {
    const s = resolveOwlSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(kind: string, index: number): string {
    return owlNodeColor(kind, index);
  }

  superLabel(cls: OwlClass): string {
    return cls.superClasses.length ? cls.superClasses.join(', ') : '—';
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  ngAfterViewInit(): void {
    if (this.isBrowser) this.observeCanvasResize();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  // ---------------------------------------------------------------------------
  // Host listeners
  // ---------------------------------------------------------------------------

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
    if (event.key === 'Escape' && this.showExportMenu) {
      event.preventDefault();
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    if (this.isTypingTarget(event.target)) {
      if (event.key === 'Escape') (event.target as HTMLElement).blur();
      return;
    }
    if (!this.parsed) return;
    if (event.key === '/') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftAxiom(1);
      else if (this.viewMode === 'properties') this.shiftProperty(1);
      else this.shiftClass(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'table') this.shiftAxiom(-1);
      else if (this.viewMode === 'properties') this.shiftProperty(-1);
      else this.shiftClass(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  // ---------------------------------------------------------------------------
  // TrackBy / formatters
  // ---------------------------------------------------------------------------

  trackByFileId(_i: number, file: OwlLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByClass(_i: number, cls: OwlClass): string {
    return cls.id;
  }

  trackByProperty(_i: number, prop: OwlProperty): string {
    return prop.id;
  }

  trackByAxiom(_i: number, axiom: OwlAxiom): string {
    return axiom.id;
  }

  formatSize(bytes: number): string {
    return formatOwlFileSize(bytes);
  }

  // ---------------------------------------------------------------------------
  // File load / clear
  // ---------------------------------------------------------------------------

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
    const { accepted, rejected } = filterValidOwlFiles(files);
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
          const bytes = await readOwlFileBytes(file);
          const record = createOwlFileRecord(file, bytes);
          const existing = this.files.findIndex((item) => item.id === record.id);
          if (existing >= 0) {
            this.files[existing] = record;
            this.currentIndex = existing;
          } else {
            this.files = [...this.files, record];
            this.currentIndex = this.files.length - 1;
          }
          this.resetViewForCurrent();
        } catch (error) {
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid OWL ontology'}`;
          this.toast.error(this.errorMessage);
        }
      }
      this.renderCanvas();
      if (this.currentFile) {
        this.toast.success(`Loaded ${this.currentFile.name}`);
        if (this.currentFile.softFail) {
          this.toast.warning('Parsed with little or no classes/properties — metadata may still be available');
        } else if (this.currentFile.warnings.length) {
          this.toast.info(`${this.currentFile.warnings.length} note(s) about this file`);
        }
      }
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleOwlFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
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
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedClassId = '';
    this.selectedPropertyId = '';
    this.selectedAxiomId = '';
    this.errorMessage = '';
    this.query = '';
    this.showExportMenu = false;
    this.showDropZone = false;
    this.dragDepth = 0;
    this.dismissedSuggestionId = null;
    this.clearCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Selection / filter
  // ---------------------------------------------------------------------------

  selectClass(id: string): void {
    this.selectedClassId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectProperty(id: string): void {
    this.selectedPropertyId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectAxiom(id: string): void {
    this.selectedAxiomId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    if (this.selectedClassId && !this.filteredClasses.some((c) => c.id === this.selectedClassId)) {
      this.selectedClassId = this.filteredClasses[0]?.id ?? '';
    }
    if (this.selectedPropertyId && !this.filteredProperties.some((p) => p.id === this.selectedPropertyId)) {
      this.selectedPropertyId = this.filteredProperties[0]?.id ?? '';
    }
    if (this.selectedAxiomId && !this.filteredAxioms.some((a) => a.id === this.selectedAxiomId)) {
      this.selectedAxiomId = this.filteredAxioms[0]?.id ?? '';
    }
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Suggestions / view mode / chrome / export
  // ---------------------------------------------------------------------------

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { action: string }): void {
    if (suggestion.action === 'sample') void this.loadSample();
    else this.openFilePicker();
  }

  setViewMode(mode: OwlViewMode): void {
    if (this.viewMode === mode) return;
    this.viewMode = mode;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
    setTimeout(() => this.renderCanvas(), 0);
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    if (!this.canExport) {
      this.showExportMenu = false;
      this.cdr.markForCheck();
      return;
    }
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: OwlExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!this.canExport || !file?.parsed) {
      this.toast.info('Nothing to export');
      this.cdr.markForCheck();
      return;
    }
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportOwlSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'classes-csv') downloadTextFile(exportOwlClassesCsv(file.parsed), `${file.name}.classes.csv`, 'text/csv');
      else if (format === 'properties-csv') downloadTextFile(exportOwlPropertiesCsv(file.parsed), `${file.name}.properties.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Classes, or Properties to export a PNG snapshot');
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (!url) {
          this.toast.error('Could not capture PNG snapshot');
          return;
        }
        downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private shiftClass(delta: number): void {
    const list = this.filteredClasses;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedClassId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectClass(next.id);
  }

  private shiftProperty(delta: number): void {
    const list = this.filteredProperties;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((p) => p.id === this.selectedPropertyId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectProperty(next.id);
  }

  private shiftAxiom(delta: number): void {
    const list = this.filteredAxioms;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((a) => a.id === this.selectedAxiomId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectAxiom(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedClassId = this.parsed?.classes[0]?.id ?? '';
    this.selectedPropertyId = this.parsed?.properties[0]?.id ?? '';
    this.selectedAxiomId = this.parsed?.axioms[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || this.viewMode === 'table') return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(this.viewMode === 'diagram' ? 280 : 220, parent.clientHeight || 240));
    }
    if (this.viewMode === 'diagram') {
      renderOwlDiagram(canvas, this.parsed.classes, this.parsed.properties, this.parsed.axioms, this.selectedClassId || this.selectedPropertyId || null);
    } else if (this.viewMode === 'classes') {
      renderOwlClasses(canvas, this.filteredClasses, this.selectedClassId || null);
    } else if (this.viewMode === 'properties') {
      renderOwlProperties(canvas, this.filteredProperties, this.selectedPropertyId || null);
    } else {
      renderOwlAxioms(canvas, this.filteredAxioms, this.selectedAxiomId || null);
    }
  }

  private clearCanvas(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  private observeCanvasResize(): void {
    const host = this.mapWrap?.nativeElement;
    if (!host || typeof ResizeObserver === 'undefined') return;
    this.resizeObserver = new ResizeObserver(() => this.renderCanvas());
    this.resizeObserver.observe(host);
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
