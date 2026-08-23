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
  PRM_ACCEPT_ATTR,
  PRM_FORMATS_HINT,
  PRM_FORMATS_LABEL,
  PRM_RELATED_TOOLS,
  PRM_SUPPORTED_EXTENSIONS
} from '../../constants/prisma-schema-viewer.constants';
import type {
  PrmExportFormat,
  PrmField,
  PrmLoadedFile,
  PrmModel,
  PrmRelation,
  PrmViewMode
} from '../../types/prisma-schema-viewer.types';
import {
  buildPrmMetadataRows,
  buildPrmModelMetadata,
  buildPrmRelationMetadata,
  canExportPrm,
  canvasToPngDataUrl,
  createPrmFileRecord,
  createSamplePrmFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportPrmModelsCsv,
  exportPrmRelationsCsv,
  exportPrmSummaryJson,
  filterPrmModels,
  filterPrmRelations,
  filterValidPrmFiles,
  formatPrmFileSize,
  prmModelColor,
  readPrmFileBytes,
  renderPrmDiagram,
  renderPrmModels,
  renderPrmRelations,
  resolvePrmSuggestion
} from '../../utils/prisma-schema-viewer.utils';

@Component({
  selector: 'lib-prisma-schema-viewer',
  standalone: true,
  templateUrl: './prisma-schema-viewer.html',
  styleUrls: ['./prisma-schema-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PrismaSchemaViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = PRM_ACCEPT_ATTR;
  readonly relatedTools = PRM_RELATED_TOOLS;
  readonly supportedExtensions = PRM_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = PRM_FORMATS_LABEL;
  readonly formatsHint = PRM_FORMATS_HINT;
  readonly viewModes: Array<{ id: PrmViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'models', label: 'Models' },
    { id: 'relations', label: 'Relations' },
    { id: 'table', label: 'Table' }
  ];

  files: PrmLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: PrmViewMode = 'diagram';
  query = '';
  selectedModelId = '';
  selectedRelationId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): PrmLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportPrm(this.currentFile);
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

  get selectedModel(): PrmModel | null {
    return this.parsed?.models.find((m) => m.id === this.selectedModelId) ?? null;
  }

  get selectedRelation(): PrmRelation | null {
    return this.parsed?.relations.find((r) => r.id === this.selectedRelationId) ?? null;
  }

  get filteredModels(): PrmModel[] {
    return this.parsed ? filterPrmModels(this.parsed.models, this.query) : [];
  }

  get filteredRelations(): PrmRelation[] {
    return this.parsed ? filterPrmRelations(this.parsed.relations, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildPrmMetadataRows(this.parsed) : [];
  }

  get modelMetadataRows() {
    return this.selectedModel ? buildPrmModelMetadata(this.selectedModel) : [];
  }

  get relationMetadataRows() {
    return this.selectedRelation ? buildPrmRelationMetadata(this.selectedRelation) : [];
  }

  get primarySuggestion() {
    const s = resolvePrmSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(kind: string, index: number): string {
    return prmModelColor(kind, index);
  }

  fieldBadge(field: PrmField): string {
    if (field.isId) return '@id';
    if (field.isUnique) return '@uq';
    if (field.relation) return 'rel';
    return '';
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
      if (this.viewMode === 'relations' || this.viewMode === 'table') this.shiftRelation(1);
      else this.shiftModel(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'relations' || this.viewMode === 'table') this.shiftRelation(-1);
      else this.shiftModel(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: PrmLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByModel(_i: number, model: PrmModel): string {
    return model.id;
  }

  trackByRelation(_i: number, rel: PrmRelation): string {
    return rel.id;
  }

  formatSize(bytes: number): string {
    return formatPrmFileSize(bytes);
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
    const { accepted, rejected } = filterValidPrmFiles(files);
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
          const bytes = await readPrmFileBytes(file);
          const record = createPrmFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Prisma schema'}`;
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
    await this.handleFiles([createSamplePrmFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectModel(id: string): void {
    this.selectedModelId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRelation(id: string): void {
    this.selectedRelationId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const model = this.filteredModels[0];
    if (model && !this.filteredModels.some((m) => m.id === this.selectedModelId)) this.selectedModelId = model.id;
    const rel = this.filteredRelations[0];
    if (rel && !this.filteredRelations.some((r) => r.id === this.selectedRelationId)) this.selectedRelationId = rel.id;
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
    this.selectedModelId = '';
    this.selectedRelationId = '';
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

  setViewMode(mode: PrmViewMode): void {
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

  exportAs(format: PrmExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportPrmSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'models-csv') downloadTextFile(exportPrmModelsCsv(file.parsed), `${file.name}.models.csv`, 'text/csv');
      else if (format === 'relations-csv') downloadTextFile(exportPrmRelationsCsv(file.parsed), `${file.name}.relations.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Models, or Relations to export a PNG snapshot');
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

  private shiftModel(delta: number): void {
    const list = this.filteredModels;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((m) => m.id === this.selectedModelId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectModel(next.id);
  }

  private shiftRelation(delta: number): void {
    const list = this.filteredRelations;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedRelationId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRelation(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedModelId = this.parsed?.models[0]?.id ?? '';
    this.selectedRelationId = this.parsed?.relations[0]?.id ?? '';
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
      renderPrmDiagram(canvas, this.parsed.models, this.parsed.relations, this.selectedModelId || null);
    } else if (this.viewMode === 'models') {
      renderPrmModels(canvas, this.filteredModels, this.selectedModelId || null);
    } else renderPrmRelations(canvas, this.filteredRelations, this.selectedRelationId || null);
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
