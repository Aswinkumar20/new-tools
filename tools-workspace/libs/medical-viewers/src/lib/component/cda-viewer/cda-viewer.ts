import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  PLATFORM_ID,
  SecurityContext,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import {
  CDA_ACCEPT_ATTR,
  CDA_FORMATS_HINT,
  CDA_FORMATS_LABEL,
  CDA_RELATED_TOOLS,
  CDA_SUPPORTED_EXTENSIONS
} from '../../constants/cda-viewer.constants';
import type {
  CdaExportFormat,
  CdaLoadedDocument,
  CdaSection,
  CdaViewMode
} from '../../types/cda-viewer.types';
import {
  canExportCda,
  createCdaDocumentRecord,
  createSampleCdaFile,
  downloadBinaryFile,
  downloadTextFile,
  exportCdaNarrativeText,
  exportCdaSectionsJson,
  exportCdaSummaryJson,
  filterCdaSections,
  filterValidCdaFiles,
  formatCdaFileSize,
  mapCdaNarrativeToHtml,
  readCdaFileBytes,
  resolveCdaSuggestion
} from '../../utils/cda-viewer.utils';
import {
  clipboardFiles,
  clipboardText,
  fileFromPastedText,
  looksLikeCdaText
} from '../../utils/clinical-document.utils';

@Component({
  selector: 'lib-cda-viewer',
  standalone: true,
  templateUrl: './cda-viewer.html',
  styleUrls: ['./cda-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CdaViewerComponent {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('sectionSearchInput') sectionSearchInput!: ElementRef<HTMLInputElement>;

  readonly acceptAttr = CDA_ACCEPT_ATTR;
  readonly relatedTools = CDA_RELATED_TOOLS;
  readonly supportedExtensions = CDA_SUPPORTED_EXTENSIONS;
  readonly formatsLabel = CDA_FORMATS_LABEL;
  readonly formatsHint = CDA_FORMATS_HINT;
  readonly viewModes: ReadonlyArray<{ id: CdaViewMode; label: string }> = [
    { id: 'sections', label: 'Sections' },
    { id: 'narrative', label: 'Narrative' },
    { id: 'raw', label: 'Raw XML' }
  ];

  documents: CdaLoadedDocument[] = [];
  currentIndex = -1;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  showExportMenu = false;
  sidebarCollapsed = false;
  dismissedSuggestionId: string | null = null;

  sectionQuery = '';
  viewMode: CdaViewMode = 'sections';
  selectedSectionId: string | null = null;

  private dragDepth = 0;

  get currentDocument(): CdaLoadedDocument | null {
    return this.currentIndex >= 0 ? this.documents[this.currentIndex] ?? null : null;
  }

  get canExport(): boolean {
    return canExportCda(this.currentDocument);
  }

  get warnings(): string[] {
    return this.currentDocument?.warnings ?? [];
  }

  get primarySuggestion() {
    const suggestion = resolveCdaSuggestion({
      hasDocuments: this.documents.length > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || suggestion.id === this.dismissedSuggestionId) return null;
    return suggestion;
  }

  get filteredSections(): CdaSection[] {
    const doc = this.currentDocument;
    if (!doc) return [];
    return filterCdaSections(doc.parsed.sections, this.sectionQuery);
  }

  get selectedSection(): CdaSection | null {
    if (!this.selectedSectionId || !this.currentDocument) return null;
    return this.currentDocument.parsed.sections.find((s) => s.id === this.selectedSectionId) ?? null;
  }

  get headerLabel(): string {
    const doc = this.currentDocument;
    if (!doc) return '';
    const p = doc.parsed;
    return `${p.title}${p.effectiveTime ? ' · ' + p.effectiveTime : ''} · ${p.sections.length} sections`;
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

  @HostListener('window:paste', ['$event'])
  async onWindowPaste(event: ClipboardEvent): Promise<void> {
    if (this.isTypingTarget(event.target)) return;
    const files = clipboardFiles(event);
    if (files.length) {
      event.preventDefault();
      await this.handleFiles(files);
      return;
    }
    const text = clipboardText(event);
    if (!looksLikeCdaText(text)) return;
    const file = fileFromPastedText(text, 'pasted-cda.xml', 'application/xml');
    if (!file) return;
    event.preventDefault();
    await this.handleFiles([file]);
  }

  @HostListener('window:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.currentDocument || this.isTypingTarget(event.target)) return;
    if (event.key === '/') {
      event.preventDefault();
      this.sectionSearchInput?.nativeElement?.focus();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      if (this.showExportMenu) this.showExportMenu = false;
      else if (this.selectedSectionId) this.selectedSectionId = null;
      this.cdr.markForCheck();
    }
  }

  trackByDocumentId(_index: number, doc: CdaLoadedDocument): string {
    return doc.id;
  }

  trackBySectionId(_index: number, section: CdaSection): string {
    return section.id;
  }

  trackByWarning(_index: number, warning: string): string {
    return warning;
  }

  formatSize(bytes: number): string {
    return formatCdaFileSize(bytes);
  }

  narrativeHtml(html: string): string {
    const mapped = mapCdaNarrativeToHtml(html);
    return this.sanitizer.sanitize(SecurityContext.HTML, mapped) ?? '<p>No narrative content</p>';
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
    const { accepted, rejected } = filterValidCdaFiles(files);
    for (const item of rejected) this.toast.error(`${item.name}: ${item.reason}`);
    if (!accepted.length) {
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.cdr.markForCheck();

    try {
      const loaded: CdaLoadedDocument[] = [];
      for (const file of accepted) {
        try {
          const bytes = await readCdaFileBytes(file);
          loaded.push(createCdaDocumentRecord(file, bytes));
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Invalid CDA document';
          this.errorMessage = `${file.name}: ${message}`;
          this.toast.error(this.errorMessage);
        }
      }

      if (loaded.length) {
        const merged = [...this.documents, ...loaded];
        const byId = new Map<string, CdaLoadedDocument>();
        for (const item of merged) byId.set(item.id, item);
        this.documents = Array.from(byId.values());
        this.currentIndex = Math.min(
          Math.max(0, this.documents.length - loaded.length),
          this.documents.length - 1
        );
        this.resetView();
        const current = this.currentDocument;
        if (current) {
          this.toast.success(`Loaded ${current.name}`);
          if (current.warnings.length) {
            this.toast.info(`${current.warnings.length} note(s) about this document`);
          }
        }
      }
    } catch (error) {
      this.errorMessage = error instanceof Error ? error.message : 'Failed to load CDA document';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  async loadSample(): Promise<void> {
    await this.handleFiles([createSampleCdaFile()]);
  }

  selectDocument(index: number): void {
    if (index < 0 || index >= this.documents.length || index === this.currentIndex) return;
    this.currentIndex = index;
    this.resetView();
    this.cdr.markForCheck();
  }

  removeDocument(index: number, event: Event): void {
    event.stopPropagation();
    if (index < 0 || index >= this.documents.length) return;
    const next = this.documents.filter((_, i) => i !== index);
    this.documents = next;
    if (!next.length) {
      this.clearAll();
      return;
    }
    if (this.currentIndex >= next.length) this.currentIndex = next.length - 1;
    else if (index < this.currentIndex) this.currentIndex -= 1;
    this.resetView();
    this.cdr.markForCheck();
  }

  clearAll(): void {
    this.documents = [];
    this.currentIndex = -1;
    this.errorMessage = '';
    this.resetView();
    this.cdr.markForCheck();
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  applySuggestion(suggestion: { id: string }): void {
    if (suggestion.id === 'try-sample') void this.loadSample();
    else if (suggestion.id === 'upload') this.openFilePicker();
  }

  setViewMode(mode: CdaViewMode): void {
    this.viewMode = mode;
    this.cdr.markForCheck();
  }

  selectSection(section: CdaSection): void {
    this.selectedSectionId = section.id;
    this.viewMode = 'narrative';
    this.cdr.markForCheck();
  }

  toggleSidebar(): void {
    this.sidebarCollapsed = !this.sidebarCollapsed;
    this.cdr.markForCheck();
  }

  toggleExportMenu(event: Event): void {
    event.stopPropagation();
    this.showExportMenu = !this.showExportMenu;
    this.cdr.markForCheck();
  }

  exportAs(format: CdaExportFormat, event?: Event): void {
    event?.stopPropagation();
    this.showExportMenu = false;
    const current = this.currentDocument;
    if (!current) {
      this.toast.error('Nothing to export');
      return;
    }
    const base = current.name.replace(/\.[^.]+$/, '') || 'cda-document';
    try {
      if (format === 'original') {
        downloadBinaryFile(current.bytes, current.name, 'application/xml');
        this.toast.success('Exported original file');
      } else if (format === 'summary-json') {
        downloadTextFile(exportCdaSummaryJson(current), `${base}-summary.json`, 'application/json');
        this.toast.success('Exported summary JSON');
      } else if (format === 'sections-json') {
        downloadTextFile(exportCdaSectionsJson(current), `${base}-sections.json`, 'application/json');
        this.toast.success('Exported sections JSON');
      } else if (format === 'narrative-txt') {
        downloadTextFile(exportCdaNarrativeText(current.parsed), `${base}-narrative.txt`, 'text/plain');
        this.toast.success('Exported narrative text');
      }
    } catch (error) {
      this.toast.error(error instanceof Error ? error.message : 'Export failed');
    }
    this.cdr.markForCheck();
  }

  private resetView(): void {
    this.sectionQuery = '';
    this.viewMode = 'sections';
    this.selectedSectionId = null;
  }

  private isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
  }

  private isFileDrag(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes('Files');
  }
}
