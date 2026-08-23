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
  THREAT_ACCEPT_ATTR,
  THREAT_FORMATS_HINT,
  THREAT_FORMATS_LABEL,
  THREAT_RELATED_TOOLS,
  THREAT_SUPPORTED_EXTENSIONS
} from '../../constants/threat-intelligence-viewer.constants';
import type {
  ThreatExportFormat,
  ThreatIndicator,
  ThreatLoadedFile,
  ThreatObject,
  ThreatRelationship,
  ThreatViewMode
} from '../../types/threat-intelligence-viewer.types';
import {
  buildThreatIndicatorMetadata,
  buildThreatMetadataRows,
  buildThreatObjectMetadata,
  buildThreatRelationshipMetadata,
  canExportThreat,
  canvasToPngDataUrl,
  createSampleThreatFile,
  createThreatFileRecord,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportThreatIndicatorsCsv,
  exportThreatRelationshipsCsv,
  exportThreatSummaryJson,
  filterThreatIndicators,
  filterThreatObjects,
  filterThreatRelationships,
  filterValidThreatFiles,
  formatThreatFileSize,
  readThreatFileBytes,
  renderThreatIndicatorTypes,
  renderThreatRelationships,
  resolveThreatSuggestion,
  threatIndicatorTypeColor,
  threatObjectKindColor,
  threatRelationshipColor
} from '../../utils/threat-intelligence-viewer.utils';

@Component({
  selector: 'lib-threat-intelligence-viewer',
  standalone: true,
  templateUrl: './threat-intelligence-viewer.html',
  styleUrls: ['./threat-intelligence-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThreatIntelligenceViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = THREAT_ACCEPT_ATTR;
  readonly relatedTools = THREAT_RELATED_TOOLS;
  readonly supportedExtensions = THREAT_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = THREAT_FORMATS_LABEL;
  readonly formatsHint = THREAT_FORMATS_HINT;
  readonly viewModes: Array<{ id: ThreatViewMode; label: string }> = [
    { id: 'indicators', label: 'Indicators' },
    { id: 'relationships', label: 'Relationships' },
    { id: 'objects', label: 'Objects' },
    { id: 'table', label: 'Table' }
  ];

  files: ThreatLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: ThreatViewMode = 'indicators';
  query = '';
  selectedIocId = '';
  selectedRelId = '';
  selectedObjectId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): ThreatLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportThreat(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildThreatMetadataRows(this.parsed) : [];
  }

  get filteredIndicators(): ThreatIndicator[] {
    return this.parsed ? filterThreatIndicators(this.parsed.indicators, this.query) : [];
  }

  get filteredRelationships(): ThreatRelationship[] {
    return this.parsed ? filterThreatRelationships(this.parsed.relationships, this.query) : [];
  }

  get filteredObjects(): ThreatObject[] {
    return this.parsed ? filterThreatObjects(this.parsed.objects, this.query) : [];
  }

  get selectedIndicator(): ThreatIndicator | null {
    return this.filteredIndicators.find((i) => i.id === this.selectedIocId) ?? this.filteredIndicators[0] ?? null;
  }

  get selectedRelationship(): ThreatRelationship | null {
    return this.filteredRelationships.find((r) => r.id === this.selectedRelId) ?? this.filteredRelationships[0] ?? null;
  }

  get selectedObject(): ThreatObject | null {
    return this.filteredObjects.find((o) => o.id === this.selectedObjectId) ?? this.filteredObjects[0] ?? null;
  }

  get indicatorMetadataRows() {
    return this.selectedIndicator ? buildThreatIndicatorMetadata(this.selectedIndicator) : [];
  }

  get relationshipMetadataRows() {
    return this.selectedRelationship ? buildThreatRelationshipMetadata(this.selectedRelationship) : [];
  }

  get objectMetadataRows() {
    return this.selectedObject ? buildThreatObjectMetadata(this.selectedObject) : [];
  }

  get primarySuggestion() {
    const s = resolveThreatSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  typeTint(type: string): string {
    return threatIndicatorTypeColor(type);
  }

  relTint(type: string): string {
    return threatRelationshipColor(type);
  }

  kindTint(kind: string): string {
    return threatObjectKindColor(kind);
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
      if (this.viewMode === 'relationships') this.shiftRel(1);
      else if (this.viewMode === 'objects') this.shiftObject(1);
      else this.shiftIoc(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'relationships') this.shiftRel(-1);
      else if (this.viewMode === 'objects') this.shiftObject(-1);
      else this.shiftIoc(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: ThreatLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByIoc(_i: number, ioc: ThreatIndicator): string {
    return ioc.id;
  }

  trackByRel(_i: number, rel: ThreatRelationship): string {
    return rel.id;
  }

  trackByObject(_i: number, obj: ThreatObject): string {
    return obj.id;
  }

  formatSize(bytes: number): string {
    return formatThreatFileSize(bytes);
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
    const { accepted, rejected } = filterValidThreatFiles(files);
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
          const bytes = await readThreatFileBytes(file);
          const record = createThreatFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid threat intel feed'}`;
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
    await this.handleFiles([createSampleThreatFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectIoc(id: string): void {
    this.selectedIocId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRel(id: string): void {
    this.selectedRelId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectObject(id: string): void {
    this.selectedObjectId = id;
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const ioc = this.filteredIndicators[0];
    if (ioc && !this.filteredIndicators.some((i) => i.id === this.selectedIocId)) this.selectedIocId = ioc.id;
    const rel = this.filteredRelationships[0];
    if (rel && !this.filteredRelationships.some((r) => r.id === this.selectedRelId)) this.selectedRelId = rel.id;
    const obj = this.filteredObjects[0];
    if (obj && !this.filteredObjects.some((o) => o.id === this.selectedObjectId)) this.selectedObjectId = obj.id;
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
  }

  clearAll(): void {
    this.files = [];
    this.currentIndex = -1;
    this.selectedIocId = '';
    this.selectedRelId = '';
    this.selectedObjectId = '';
    this.errorMessage = '';
    this.query = '';
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

  setViewMode(mode: ThreatViewMode): void {
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
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: ThreatExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportThreatSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'indicators-csv') downloadTextFile(exportThreatIndicatorsCsv(file.parsed), `${file.name}.indicators.csv`, 'text/csv');
      else if (format === 'relationships-csv') downloadTextFile(exportThreatRelationshipsCsv(file.parsed), `${file.name}.relationships.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'indicators' && this.viewMode !== 'relationships')) {
          this.toast.info('Open Indicators or Relationships to export a PNG snapshot');
          return;
        }
        const url = canvasToPngDataUrl(canvas);
        if (url) downloadDataUrl(url, `${file.name}.png`);
      }
      this.toast.success('Export started');
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private shiftIoc(delta: number): void {
    const list = this.filteredIndicators;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((i) => i.id === this.selectedIocId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectIoc(next.id);
  }

  private shiftRel(delta: number): void {
    const list = this.filteredRelationships;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedRelId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRel(next.id);
  }

  private shiftObject(delta: number): void {
    const list = this.filteredObjects;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((o) => o.id === this.selectedObjectId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectObject(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedIocId = this.parsed?.indicators[0]?.id ?? '';
    this.selectedRelId = this.parsed?.relationships[0]?.id ?? '';
    this.selectedObjectId = this.parsed?.objects[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'indicators' && this.viewMode !== 'relationships')) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(280, parent.clientHeight || 220));
    }
    if (this.viewMode === 'indicators') {
      renderThreatIndicatorTypes(canvas, this.parsed.indicatorTypes, this.selectedIndicator?.type ?? null);
    } else {
      renderThreatRelationships(canvas, this.parsed.relationshipTypes, this.selectedRelationship?.type ?? null);
    }
  }

  private clearCanvas(): void {
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
