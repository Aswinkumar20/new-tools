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
  ER_ACCEPT_ATTR,
  ER_FORMATS_HINT,
  ER_FORMATS_LABEL,
  ER_RELATED_TOOLS,
  ER_SUPPORTED_EXTENSIONS
} from '../../constants/er-diagram-viewer.constants';
import type {
  ErEntity,
  ErExportFormat,
  ErKey,
  ErLoadedFile,
  ErRelation,
  ErViewMode
} from '../../types/er-diagram-viewer.types';
import {
  buildErEntityMetadata,
  buildErKeyMetadata,
  buildErMetadataRows,
  buildErRelationMetadata,
  canExportEr,
  canvasToPngDataUrl,
  createErFileRecord,
  createSampleErFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  erEntityColor,
  erKeyColor,
  exportErEntitiesCsv,
  exportErKeysCsv,
  exportErSummaryJson,
  filterErEntities,
  filterErKeys,
  filterErRelations,
  filterValidErFiles,
  formatErFileSize,
  readErFileBytes,
  renderErDiagram,
  renderErEntities,
  renderErKeys,
  resolveErSuggestion
} from '../../utils/er-diagram-viewer.utils';

@Component({
  selector: 'lib-er-diagram-viewer',
  standalone: true,
  templateUrl: './er-diagram-viewer.html',
  styleUrls: ['./er-diagram-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ErDiagramViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = ER_ACCEPT_ATTR;
  readonly relatedTools = ER_RELATED_TOOLS;
  readonly supportedExtensions = ER_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = ER_FORMATS_LABEL;
  readonly formatsHint = ER_FORMATS_HINT;
  readonly viewModes: Array<{ id: ErViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'entities', label: 'Entities' },
    { id: 'keys', label: 'Keys' },
    { id: 'table', label: 'Table' }
  ];

  files: ErLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: ErViewMode = 'diagram';
  query = '';
  selectedEntityId = '';
  selectedKeyId = '';
  selectedRelationId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): ErLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportEr(this.currentFile);
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

  get selectedEntity(): ErEntity | null {
    return this.parsed?.entities.find((e) => e.id === this.selectedEntityId) ?? null;
  }

  get selectedKey(): ErKey | null {
    return this.parsed?.keys.find((k) => k.id === this.selectedKeyId) ?? null;
  }

  get selectedRelation(): ErRelation | null {
    return this.parsed?.relations.find((r) => r.id === this.selectedRelationId) ?? null;
  }

  get filteredEntities(): ErEntity[] {
    return this.parsed ? filterErEntities(this.parsed.entities, this.query) : [];
  }

  get filteredKeys(): ErKey[] {
    return this.parsed ? filterErKeys(this.parsed.keys, this.query) : [];
  }

  get filteredRelations(): ErRelation[] {
    return this.parsed ? filterErRelations(this.parsed.relations, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildErMetadataRows(this.parsed) : [];
  }

  get entityMetadataRows() {
    return this.selectedEntity ? buildErEntityMetadata(this.selectedEntity) : [];
  }

  get keyMetadataRows() {
    return this.selectedKey ? buildErKeyMetadata(this.selectedKey) : [];
  }

  get relationMetadataRows() {
    return this.selectedRelation ? buildErRelationMetadata(this.selectedRelation) : [];
  }

  get primarySuggestion() {
    const s = resolveErSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(kind: string, index: number): string {
    if (kind === 'pk' || kind === 'fk' || kind === 'unique') return erKeyColor(kind);
    return erEntityColor(index);
  }

  columnBadge(column: { pk: boolean; fk: boolean; unique: boolean }): string {
    if (column.pk) return 'PK';
    if (column.fk) return 'FK';
    if (column.unique) return 'UK';
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
      if (this.viewMode === 'keys') this.shiftKey(1);
      else if (this.viewMode === 'table') this.shiftRelation(1);
      else this.shiftEntity(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'keys') this.shiftKey(-1);
      else if (this.viewMode === 'table') this.shiftRelation(-1);
      else this.shiftEntity(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: ErLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByEntity(_i: number, entity: ErEntity): string {
    return entity.id;
  }

  trackByKey(_i: number, key: ErKey): string {
    return key.id;
  }

  trackByRelation(_i: number, relation: ErRelation): string {
    return relation.id;
  }

  formatSize(bytes: number): string {
    return formatErFileSize(bytes);
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
    const { accepted, rejected } = filterValidErFiles(files);
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
          const bytes = await readErFileBytes(file);
          const record = createErFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid ER diagram'}`;
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
    await this.handleFiles([createSampleErFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectEntity(id: string): void {
    this.selectedEntityId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectKey(id: string): void {
    this.selectedKeyId = id;
    const key = this.parsed?.keys.find((k) => k.id === id);
    if (key) this.selectedEntityId = key.entityId;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRelation(id: string): void {
    this.selectedRelationId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const entity = this.filteredEntities[0];
    if (entity && !this.filteredEntities.some((e) => e.id === this.selectedEntityId)) this.selectedEntityId = entity.id;
    const key = this.filteredKeys[0];
    if (key && !this.filteredKeys.some((k) => k.id === this.selectedKeyId)) this.selectedKeyId = key.id;
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
    this.selectedEntityId = '';
    this.selectedKeyId = '';
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

  setViewMode(mode: ErViewMode): void {
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

  exportAs(format: ErExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportErSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'entities-csv') downloadTextFile(exportErEntitiesCsv(file.parsed), `${file.name}.entities.csv`, 'text/csv');
      else if (format === 'keys-csv') downloadTextFile(exportErKeysCsv(file.parsed), `${file.name}.keys.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Entities, or Keys to export a PNG snapshot');
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

  private shiftEntity(delta: number): void {
    const list = this.filteredEntities;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((e) => e.id === this.selectedEntityId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectEntity(next.id);
  }

  private shiftKey(delta: number): void {
    const list = this.filteredKeys;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((k) => k.id === this.selectedKeyId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectKey(next.id);
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
    this.selectedEntityId = this.parsed?.entities[0]?.id ?? '';
    this.selectedKeyId = this.parsed?.keys[0]?.id ?? '';
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
      renderErDiagram(canvas, this.parsed.entities, this.parsed.relations, this.selectedEntityId || null);
    } else if (this.viewMode === 'entities') {
      renderErEntities(canvas, this.filteredEntities, this.selectedEntityId || null);
    } else renderErKeys(canvas, this.filteredKeys, this.selectedKeyId || null);
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
