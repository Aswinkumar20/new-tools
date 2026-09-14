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
  ELF_BINARY_ACCEPT_ATTR,
  ELF_BINARY_DESCRIPTION,
  ELF_BINARY_FORMATS_LABEL,
  ELF_BINARY_HELP_ITEMS,
  ELF_BINARY_RELATED_TOOLS,
  ELF_BINARY_TITLE
} from '../../constants/elf-binary-viewer.constants';
import {
  formatElfSize,
  isElfBinaryFile,
  parseElfBinary,
  resolveElfSuggestion,
  type ElfParseResult,
  type ElfSectionInfo
} from '../../utils/elf-binary-viewer.utils';

@Component({
  selector: 'lib-elf-binary-viewer',
  standalone: true,
  templateUrl: './elf-binary-viewer.html',
  styleUrls: ['./elf-binary-viewer.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ElfBinaryViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly title = ELF_BINARY_TITLE;
  readonly description = ELF_BINARY_DESCRIPTION;
  readonly acceptAttr = ELF_BINARY_ACCEPT_ATTR;
  readonly formatsLabel = ELF_BINARY_FORMATS_LABEL;
  readonly helpItems = ELF_BINARY_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = ELF_BINARY_RELATED_TOOLS;
  readonly formatSize = formatElfSize;

  fileName = '';
  binary: ElfParseResult | null = null;
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
      { label: 'Class', value: this.binary.classLabel },
      { label: 'Encoding', value: this.binary.dataEncoding },
      { label: 'Entry point', value: this.binary.entryPoint },
      { label: 'Sections', value: String(this.binary.sectionCount) },
      { label: 'Segments', value: String(this.binary.segmentCount) }
    ];
  }

  get primarySuggestion() {
    const suggestion = resolveElfSuggestion({
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
    const valid = files.filter(isElfBinaryFile);
    if (!valid.length) {
      this.errorMessage = `Please upload ${this.formatsLabel}.`;
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
      this.binary = await parseElfBinary(file);
      this.fileName = file.name;
      this.toast.success(`Loaded ${file.name}`);
    } catch (error) {
      this.binary = null;
      this.fileName = '';
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to parse ELF binary.';
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

  formatHex(value: number): string {
    return `0x${value.toString(16)}`;
  }

  trackBySection(_: number, section: ElfSectionInfo): number {
    return section.index;
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes('Files');
  }
}
