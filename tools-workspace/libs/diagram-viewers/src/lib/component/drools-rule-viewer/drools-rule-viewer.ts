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
  DRL_ACCEPT_ATTR,
  DRL_FORMATS_HINT,
  DRL_FORMATS_LABEL,
  DRL_RELATED_TOOLS,
  DRL_SUPPORTED_EXTENSIONS
} from '../../constants/drools-rule-viewer.constants';
import type { DrlCondition, DrlExportFormat, DrlLoadedFile, DrlRule, DrlViewMode } from '../../types/drools-rule-viewer.types';
import {
  buildDrlConditionMetadata,
  buildDrlMetadataRows,
  buildDrlRuleMetadata,
  canExportDrl,
  canvasToPngDataUrl,
  createDrlFileRecord,
  createSampleDrlFile,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  drlRuleColor,
  exportDrlConditionsCsv,
  exportDrlRulesCsv,
  exportDrlSummaryJson,
  filterDrlConditions,
  filterDrlRules,
  filterValidDrlFiles,
  formatDrlFileSize,
  readDrlFileBytes,
  renderDrlConditions,
  renderDrlDiagram,
  renderDrlRules,
  resolveDrlSuggestion
} from '../../utils/drools-rule-viewer.utils';

@Component({
  selector: 'lib-drools-rule-viewer',
  standalone: true,
  templateUrl: './drools-rule-viewer.html',
  styleUrls: ['./drools-rule-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective, StatValueTooltipHostDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DroolsRuleViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = DRL_ACCEPT_ATTR;
  readonly relatedTools = DRL_RELATED_TOOLS;
  readonly supportedExtensions = DRL_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DRL_FORMATS_LABEL;
  readonly formatsHint = DRL_FORMATS_HINT;
  readonly viewModes: Array<{ id: DrlViewMode; label: string }> = [
    { id: 'diagram', label: 'Diagram' },
    { id: 'rules', label: 'Rules' },
    { id: 'conditions', label: 'Conditions' },
    { id: 'table', label: 'Table' }
  ];

  files: DrlLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: DrlViewMode = 'diagram';
  query = '';
  selectedRuleId = '';
  selectedConditionId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): DrlLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportDrl(this.currentFile);
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

  get selectedRule(): DrlRule | null {
    return this.parsed?.rules.find((r) => r.id === this.selectedRuleId) ?? null;
  }

  get selectedCondition(): DrlCondition | null {
    return this.parsed?.conditions.find((c) => c.id === this.selectedConditionId) ?? null;
  }

  get filteredRules(): DrlRule[] {
    return this.parsed ? filterDrlRules(this.parsed.rules, this.query) : [];
  }

  get filteredConditions(): DrlCondition[] {
    return this.parsed ? filterDrlConditions(this.parsed.conditions, this.query) : [];
  }

  get metadataRows() {
    return this.parsed ? buildDrlMetadataRows(this.parsed) : [];
  }

  get ruleMetadataRows() {
    return this.selectedRule ? buildDrlRuleMetadata(this.selectedRule) : [];
  }

  get conditionMetadataRows() {
    return this.selectedCondition ? buildDrlConditionMetadata(this.selectedCondition) : [];
  }

  get primarySuggestion() {
    const s = resolveDrlSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  tint(index: number): string {
    return drlRuleColor(index);
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
      if (this.viewMode === 'conditions' || this.viewMode === 'table') this.shiftCondition(1);
      else this.shiftRule(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'conditions' || this.viewMode === 'table') this.shiftCondition(-1);
      else this.shiftRule(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: DrlLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByRule(_i: number, rule: DrlRule): string {
    return rule.id;
  }

  trackByCondition(_i: number, condition: DrlCondition): string {
    return condition.id;
  }

  formatSize(bytes: number): string {
    return formatDrlFileSize(bytes);
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
    const { accepted, rejected } = filterValidDrlFiles(files);
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
          const bytes = await readDrlFileBytes(file);
          const record = createDrlFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid Drools file'}`;
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
    await this.handleFiles([createSampleDrlFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRule(id: string): void {
    this.selectedRuleId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectCondition(id: string): void {
    this.selectedConditionId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const rule = this.filteredRules[0];
    if (rule && !this.filteredRules.some((r) => r.id === this.selectedRuleId)) this.selectedRuleId = rule.id;
    const cond = this.filteredConditions[0];
    if (cond && !this.filteredConditions.some((c) => c.id === this.selectedConditionId)) this.selectedConditionId = cond.id;
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
    this.selectedRuleId = '';
    this.selectedConditionId = '';
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

  setViewMode(mode: DrlViewMode): void {
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

  exportAs(format: DrlExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportDrlSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'conditions-csv') downloadTextFile(exportDrlConditionsCsv(file.parsed), `${file.name}.conditions.csv`, 'text/csv');
      else if (format === 'rules-csv') downloadTextFile(exportDrlRulesCsv(file.parsed), `${file.name}.rules.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || this.viewMode === 'table') {
          this.toast.info('Open Diagram, Rules, or Conditions to export a PNG snapshot');
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

  private shiftRule(delta: number): void {
    const list = this.filteredRules;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedRuleId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRule(next.id);
  }

  private shiftCondition(delta: number): void {
    const list = this.filteredConditions;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((c) => c.id === this.selectedConditionId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectCondition(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedRuleId = this.parsed?.rules[0]?.id ?? '';
    this.selectedConditionId = this.parsed?.conditions[0]?.id ?? '';
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
      renderDrlDiagram(canvas, this.parsed.rules, this.parsed.conditions, this.selectedRuleId || this.selectedConditionId || null);
    } else if (this.viewMode === 'rules') {
      renderDrlRules(canvas, this.filteredRules, this.selectedRuleId || null);
    } else renderDrlConditions(canvas, this.filteredConditions, this.selectedConditionId || null);
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
