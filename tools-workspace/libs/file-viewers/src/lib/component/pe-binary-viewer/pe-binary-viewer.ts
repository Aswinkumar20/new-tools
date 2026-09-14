import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  PE_BINARY_ACCEPT_ATTR,
  PE_BINARY_DESCRIPTION,
  PE_BINARY_FORMATS_LABEL,
  PE_BINARY_HELP_ITEMS,
  PE_BINARY_RELATED_TOOLS,
  PE_BINARY_TITLE
} from '../../constants/pe-binary-viewer.constants';
import {
  isPeBinaryFile,
  parsePeBinary,
  resolvePeSuggestion,
  type PeImportInfo,
  type PeParseResult,
  type PeSectionInfo
} from '../../utils/pe-binary-viewer.utils';

@Component({
  selector: 'lib-pe-binary-viewer',
  standalone: true,
  templateUrl: './pe-binary-viewer.html',
  styleUrls: ['./pe-binary-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PeBinaryViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly title = PE_BINARY_TITLE;
  readonly description = PE_BINARY_DESCRIPTION;
  readonly acceptAttr = PE_BINARY_ACCEPT_ATTR;
  readonly formatsLabel = PE_BINARY_FORMATS_LABEL;
  readonly helpItems = PE_BINARY_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = PE_BINARY_RELATED_TOOLS;

  fileName = '';
  binary: PeParseResult | null = null;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  private dragDepth = 0;

  get headerFields(): Array<{ label: string; value: string }> {
    if (!this.binary) {
      return [];
    }
    return [
      { label: 'Machine', value: this.binary.machine },
      { label: 'Timestamp', value: this.binary.timestamp },
      { label: 'Subsystem', value: this.binary.subsystem },
      { label: 'Image base', value: this.binary.imageBase },
      { label: 'Entry point', value: this.binary.entryPoint },
      { label: 'Characteristics', value: this.formatCharacteristics(this.binary.characteristics) },
      { label: 'Type', value: this.binary.isDll ? 'DLL' : 'Executable' }
    ];
  }

  get importCount(): number {
    return this.binary?.imports.length ?? 0;
  }

  get primarySuggestion() {
    const suggestion = resolvePeSuggestion({
      hasBinary: !!this.binary,
      hasError: !!this.errorMessage
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  ngOnDestroy(): void {
    this.dragDepth = 0;
  }

  dismissSuggestion(id: string): void {
    this.dismissedSuggestionId = id;
    this.cdr.markForCheck();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  @HostListener('window:dragenter', ['$event'])
  onWindowDragEnter(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth += 1;
    if (!this.showDropZone) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:dragover', ['$event'])
  onWindowDragOver(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
  }

  @HostListener('window:dragleave', ['$event'])
  onWindowDragLeave(event: DragEvent): void {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0 && this.showDropZone) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('window:drop', ['$event'])
  async onWindowDrop(event: DragEvent): Promise<void> {
    if (!this.isFileDrag(event)) {
      return;
    }
    event.preventDefault();
    this.dragDepth = 0;
    this.showDropZone = false;
    const files = event.dataTransfer?.files;
    if (files?.length) {
      await this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  async handleFiles(files: File[]): Promise<void> {
    const valid = files.filter(isPeBinaryFile);
    if (!valid.length) {
      this.errorMessage = `Please upload ${this.formatsLabel} files.`;
      this.dismissedSuggestionId = null;
      this.toast.error(this.errorMessage);
      this.cdr.markForCheck();
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      const file = valid[0];
      const buffer = await file.arrayBuffer();
      this.binary = parsePeBinary(buffer);
      this.fileName = file.name;
      this.toast.success(`Loaded ${file.name}`);
    } catch (error) {
      this.binary = null;
      this.fileName = '';
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to parse PE binary.';
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    this.binary = null;
    this.fileName = '';
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.toast.info('Binary cleared');
    this.cdr.markForCheck();
  }

  formatCharacteristics(chars: string[]): string {
    return chars.length ? chars.join(', ') : '—';
  }

  trackBySection(_: number, section: PeSectionInfo): string {
    return section.name;
  }

  trackByImport(_: number, item: PeImportInfo): string {
    return item.dll;
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes('Files');
  }
}
