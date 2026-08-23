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
  DECISION_MODEL_ACCEPT_ATTR,
  DECISION_MODEL_FORMATS_HINT,
  DECISION_MODEL_FORMATS_LABEL,
  DECISION_MODEL_RELATED_TOOLS,
  DECISION_MODEL_SUPPORTED_EXTENSIONS
} from '../../constants/decision-model-viewer.constants';
import type {
  DecisionModelDecision,
  DecisionModelDependency,
  DecisionModelExportFormat,
  DecisionModelLoadedFile,
  DecisionModelRule,
  DecisionModelViewMode
} from '../../types/decision-model-viewer.types';
import {
  buildDecisionModelDecisionMetadata,
  buildDecisionModelDependencyMetadata,
  buildDecisionModelMetadataRows,
  buildDecisionModelRuleMetadata,
  canExportDecisionModel,
  canvasToPngDataUrl,
  createDecisionModelFileRecord,
  createSampleDecisionModelFile,
  decisionModelDepColor,
  decisionModelKindColor,
  downloadBinaryFile,
  downloadDataUrl,
  downloadTextFile,
  exportDecisionModelDependenciesCsv,
  exportDecisionModelRulesCsv,
  exportDecisionModelSummaryJson,
  filterDecisionModelDecisions,
  filterDecisionModelDependencies,
  filterDecisionModelRules,
  filterValidDecisionModelFiles,
  formatDecisionModelFileSize,
  readDecisionModelFileBytes,
  renderDecisionModelDecisions,
  renderDecisionModelDependencies,
  resolveDecisionModelSuggestion
} from '../../utils/decision-model-viewer.utils';

@Component({
  selector: 'lib-decision-model-viewer',
  standalone: true,
  templateUrl: './decision-model-viewer.html',
  styleUrls: ['./decision-model-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DecisionModelViewerComponent implements AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('canvasHost') canvasHost?: ElementRef<HTMLCanvasElement>;
  @ViewChild('mapWrap') mapWrap?: ElementRef<HTMLElement>;
  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;

  readonly acceptAttr = DECISION_MODEL_ACCEPT_ATTR;
  readonly relatedTools = DECISION_MODEL_RELATED_TOOLS;
  readonly supportedExtensions = DECISION_MODEL_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = DECISION_MODEL_FORMATS_LABEL;
  readonly formatsHint = DECISION_MODEL_FORMATS_HINT;
  readonly viewModes: Array<{ id: DecisionModelViewMode; label: string }> = [
    { id: 'tables', label: 'Tables' },
    { id: 'dependencies', label: 'Dependencies' },
    { id: 'rules', label: 'Rules' },
    { id: 'table', label: 'Table' }
  ];

  files: DecisionModelLoadedFile[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;
  viewMode: DecisionModelViewMode = 'tables';
  query = '';
  selectedDecisionId = '';
  selectedRuleId = '';
  selectedDepId = '';

  private dragDepth = 0;
  private resizeObserver: ResizeObserver | null = null;

  get currentFile(): DecisionModelLoadedFile | null {
    return this.currentIndex >= 0 ? this.files[this.currentIndex] ?? null : null;
  }

  get parsed() {
    return this.currentFile?.parsed ?? null;
  }

  get canExport(): boolean {
    return canExportDecisionModel(this.currentFile);
  }

  get warnings(): string[] {
    return this.currentFile?.warnings ?? [];
  }

  get metadataRows() {
    return this.parsed ? buildDecisionModelMetadataRows(this.parsed) : [];
  }

  get filteredDecisions(): DecisionModelDecision[] {
    return this.parsed ? filterDecisionModelDecisions(this.parsed.decisions, this.query) : [];
  }

  get filteredRules(): DecisionModelRule[] {
    return this.parsed ? filterDecisionModelRules(this.parsed.rules, this.query) : [];
  }

  get filteredDependencies(): DecisionModelDependency[] {
    return this.parsed ? filterDecisionModelDependencies(this.parsed.dependencies, this.query) : [];
  }

  get selectedDecision(): DecisionModelDecision | null {
    return this.filteredDecisions.find((d) => d.id === this.selectedDecisionId) ?? this.filteredDecisions[0] ?? null;
  }

  get selectedRule(): DecisionModelRule | null {
    return this.filteredRules.find((r) => r.id === this.selectedRuleId) ?? this.filteredRules[0] ?? null;
  }

  get selectedDependency(): DecisionModelDependency | null {
    return this.filteredDependencies.find((d) => d.id === this.selectedDepId) ?? this.filteredDependencies[0] ?? null;
  }

  get decisionMetadataRows() {
    return this.selectedDecision ? buildDecisionModelDecisionMetadata(this.selectedDecision) : [];
  }

  get ruleMetadataRows() {
    return this.selectedRule ? buildDecisionModelRuleMetadata(this.selectedRule) : [];
  }

  get dependencyMetadataRows() {
    return this.selectedDependency ? buildDecisionModelDependencyMetadata(this.selectedDependency) : [];
  }

  get primarySuggestion() {
    const s = resolveDecisionModelSuggestion({ hasFiles: this.files.length > 0, hasError: !!this.errorMessage });
    return !s || s.id === this.dismissedSuggestionId ? null : s;
  }

  kindTint(kind: string): string {
    return decisionModelKindColor(kind);
  }

  depTint(type: string): string {
    return decisionModelDepColor(type);
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
      if (this.viewMode === 'tables') this.shiftDecision(1);
      else if (this.viewMode === 'dependencies') this.shiftDep(1);
      else this.shiftRule(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (this.viewMode === 'tables') this.shiftDecision(-1);
      else if (this.viewMode === 'dependencies') this.shiftDep(-1);
      else this.shiftRule(-1);
    } else if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      this.query = '';
      this.onFilterChange();
    }
  }

  trackByFileId(_i: number, file: DecisionModelLoadedFile): string {
    return file.id;
  }

  trackByWarning(_i: number, warning: string): string {
    return warning;
  }

  trackByDecision(_i: number, decision: DecisionModelDecision): string {
    return decision.id;
  }

  trackByRule(_i: number, rule: DecisionModelRule): string {
    return rule.id;
  }

  trackByDep(_i: number, dep: DecisionModelDependency): string {
    return dep.id;
  }

  formatSize(bytes: number): string {
    return formatDecisionModelFileSize(bytes);
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
    const { accepted, rejected } = filterValidDecisionModelFiles(files);
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
          const bytes = await readDecisionModelFileBytes(file);
          const record = createDecisionModelFileRecord(file, bytes);
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
          this.errorMessage = `${file.name}: ${error instanceof Error ? error.message : 'Invalid decision model'}`;
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
    await this.handleFiles([createSampleDecisionModelFile()]);
  }

  selectFile(index: number): void {
    if (index < 0 || index >= this.files.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetViewForCurrent();
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectDecision(id: string): void {
    this.selectedDecisionId = id;
    const first = this.filteredRules.find((r) => r.decisionId === id);
    if (first) this.selectedRuleId = first.id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  selectRule(id: string): void {
    this.selectedRuleId = id;
    const rule = this.filteredRules.find((r) => r.id === id);
    if (rule) this.selectedDecisionId = rule.decisionId;
    this.cdr.markForCheck();
  }

  selectDep(id: string): void {
    this.selectedDepId = id;
    this.renderCanvas();
    this.cdr.markForCheck();
  }

  onFilterChange(): void {
    const decision = this.filteredDecisions[0];
    if (decision && !this.filteredDecisions.some((d) => d.id === this.selectedDecisionId)) this.selectedDecisionId = decision.id;
    const rule = this.filteredRules[0];
    if (rule && !this.filteredRules.some((r) => r.id === this.selectedRuleId)) this.selectedRuleId = rule.id;
    const dep = this.filteredDependencies[0];
    if (dep && !this.filteredDependencies.some((d) => d.id === this.selectedDepId)) this.selectedDepId = dep.id;
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
    this.selectedDecisionId = '';
    this.selectedRuleId = '';
    this.selectedDepId = '';
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

  setViewMode(mode: DecisionModelViewMode): void {
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

  exportAs(format: DecisionModelExportFormat, event: Event): void {
    event.stopPropagation();
    this.showExportMenu = false;
    const file = this.currentFile;
    if (!file?.parsed) return;
    try {
      if (format === 'original') downloadBinaryFile(file.bytes, file.name, 'application/octet-stream');
      else if (format === 'summary-json') downloadTextFile(exportDecisionModelSummaryJson(file), `${file.name}.summary.json`, 'application/json');
      else if (format === 'rules-csv') downloadTextFile(exportDecisionModelRulesCsv(file.parsed), `${file.name}.rules.csv`, 'text/csv');
      else if (format === 'dependencies-csv') downloadTextFile(exportDecisionModelDependenciesCsv(file.parsed), `${file.name}.dependencies.csv`, 'text/csv');
      else if (format === 'png') {
        const canvas = this.canvasHost?.nativeElement;
        if (!canvas || (this.viewMode !== 'tables' && this.viewMode !== 'dependencies')) {
          this.toast.info('Open Tables or Dependencies to export a PNG snapshot');
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

  private shiftDecision(delta: number): void {
    const list = this.filteredDecisions;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((d) => d.id === this.selectedDecisionId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectDecision(next.id);
  }

  private shiftRule(delta: number): void {
    const list = this.filteredRules;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((r) => r.id === this.selectedRuleId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectRule(next.id);
  }

  private shiftDep(delta: number): void {
    const list = this.filteredDependencies;
    if (!list.length) return;
    const idx = Math.max(0, list.findIndex((d) => d.id === this.selectedDepId));
    const next = list[Math.min(list.length - 1, Math.max(0, idx + delta))];
    if (next) this.selectDep(next.id);
  }

  private resetViewForCurrent(): void {
    this.query = '';
    this.selectedDecisionId = this.parsed?.decisions[0]?.id ?? '';
    this.selectedRuleId = this.parsed?.rules[0]?.id ?? '';
    this.selectedDepId = this.parsed?.dependencies[0]?.id ?? '';
  }

  private renderCanvas(): void {
    if (!this.isBrowser || (this.viewMode !== 'tables' && this.viewMode !== 'dependencies')) return;
    const canvas = this.canvasHost?.nativeElement;
    if (!canvas || !this.parsed) return;
    const parent = canvas.parentElement;
    if (parent) {
      canvas.width = Math.max(320, parent.clientWidth);
      canvas.height = Math.max(180, Math.min(280, parent.clientHeight || 220));
    }
    if (this.viewMode === 'tables') renderDecisionModelDecisions(canvas, this.filteredDecisions, this.selectedDecision?.id ?? null);
    else renderDecisionModelDependencies(canvas, this.filteredDependencies, this.selectedDependency?.id ?? null);
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
