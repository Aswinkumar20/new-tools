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
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AssetService,
  Navigation,
  ToastService,
  TooltipDirective
} from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  SUBTITLE_ACCEPT_ATTR,
  SUBTITLE_FORMATS_LABEL,
  SUBTITLE_HELP_ITEMS,
  SUBTITLE_RELATED_TOOLS,
  SUBTITLE_VIEWER_DESCRIPTION,
  SUBTITLE_VIEWER_TITLE
} from '../../constants/subtitle-viewer.constants';
import {
  filterSubtitleCues,
  formatCueTimestamp,
  isSubtitleFile,
  parseSubtitleContent,
  resolveSubtitleSuggestion,
  type SubtitleCue
} from '../../utils/subtitle-viewer.utils';

interface SubtitleLoadedFile {
  name: string;
  cues: SubtitleCue[];
}

@Component({
  selector: 'lib-subtitle-viewer',
  standalone: true,
  templateUrl: './subtitle-viewer.html',
  styleUrls: ['./subtitle-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SubtitleViewerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  readonly title = SUBTITLE_VIEWER_TITLE;
  readonly description = SUBTITLE_VIEWER_DESCRIPTION;
  readonly acceptAttr = SUBTITLE_ACCEPT_ATTR;
  readonly formatsLabel = SUBTITLE_FORMATS_LABEL;
  readonly helpItems = SUBTITLE_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = SUBTITLE_RELATED_TOOLS;

  loadedFile: SubtitleLoadedFile | null = null;
  searchQuery = '';
  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  private dragDepth = 0;

  get cues(): SubtitleCue[] {
    return this.loadedFile?.cues ?? [];
  }

  get filteredCues(): SubtitleCue[] {
    return filterSubtitleCues(this.cues, this.searchQuery);
  }

  get cueCount(): number {
    return this.cues.length;
  }

  get durationLabel(): string {
    if (!this.cues.length) {
      return '—';
    }
    const end = Math.max(...this.cues.map((cue) => cue.endSeconds));
    return formatCueTimestamp(end);
  }

  get primarySuggestion() {
    const suggestion = resolveSubtitleSuggestion({
      hasCues: this.cues.length > 0,
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

  formatTime(seconds: number): string {
    return formatCueTimestamp(seconds);
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
    const valid = files.filter(isSubtitleFile);
    if (!valid.length) {
      this.errorMessage = `Please upload a ${this.formatsLabel} subtitle file.`;
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
      const content = await file.text();
      const cues = parseSubtitleContent(content, file.name);
      if (!cues.length) {
        throw new Error('No subtitle cues found in this file.');
      }
      this.loadedFile = { name: file.name, cues };
      this.searchQuery = '';
      this.toast.success(`Loaded ${file.name}`);
    } catch (error) {
      this.errorMessage =
        error instanceof Error ? error.message : 'Failed to parse subtitle file.';
      this.loadedFile = null;
      this.toast.error(this.errorMessage);
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  clearAll(): void {
    this.loadedFile = null;
    this.searchQuery = '';
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.toast.info('Subtitle cleared');
    this.cdr.markForCheck();
  }

  onSearchChange(value: string): void {
    this.searchQuery = value;
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.cdr.markForCheck();
  }

  async copyCueText(cue: SubtitleCue): Promise<void> {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(cue.text);
        this.toast.success('Cue text copied');
      } else {
        this.toast.info(cue.text);
      }
    } catch {
      this.toast.info(cue.text);
    }
  }

  trackByCueId(_: number, cue: SubtitleCue): number {
    return cue.id;
  }

  private isFileDrag(event: DragEvent): boolean {
    return !!event.dataTransfer?.types.includes('Files');
  }
}
