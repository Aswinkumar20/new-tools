import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import type { FvRelatedToolLink } from '../../shared/fv-tool-suggestion.model';
import {
  MIDI_ACCEPT_ATTR,
  MIDI_FORMATS_LABEL,
  MIDI_HELP_ITEMS,
  MIDI_RELATED_TOOLS,
  MIDI_VIEWER_DESCRIPTION,
  MIDI_VIEWER_TITLE
} from '../../constants/midi-viewer.constants';
import {
  drawMidiPianoRoll,
  isMidiFile,
  parseMidiFile,
  resolveMidiSuggestion,
  type MidiParseResult
} from '../../utils/midi-viewer.utils';

@Component({
  selector: 'lib-midi-viewer',
  standalone: true,
  templateUrl: './midi-viewer.html',
  styleUrls: ['./midi-viewer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MidiViewerComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly platformId = inject(PLATFORM_ID);

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('pianoRollCanvas') pianoRollCanvas!: ElementRef<HTMLCanvasElement>;

  readonly title = MIDI_VIEWER_TITLE;
  readonly description = MIDI_VIEWER_DESCRIPTION;
  readonly acceptAttr = MIDI_ACCEPT_ATTR;
  readonly formatsLabel = MIDI_FORMATS_LABEL;
  readonly helpItems = MIDI_HELP_ITEMS;
  readonly relatedTools: ReadonlyArray<FvRelatedToolLink> = MIDI_RELATED_TOOLS;

  fileName = '';
  fileSize = 0;
  midiData: MidiParseResult | null = null;
  loading = false;
  errorMessage = '';
  showDropZone = false;
  dismissedSuggestionId: string | null = null;

  private readonly preventDefaultsFn = (e: Event) => this.preventDefaults(e);
  private resizeObserver: ResizeObserver | null = null;

  get primarySuggestion() {
    const suggestion = resolveMidiSuggestion({
      hasNotes: (this.midiData?.notes.length ?? 0) > 0,
      hasError: !!this.errorMessage
    });
    if (!suggestion || this.dismissedSuggestionId === suggestion.id) {
      return null;
    }
    return suggestion;
  }

  get totalNotes(): number {
    return this.midiData?.notes.length ?? 0;
  }

  get trackCount(): number {
    return this.midiData?.tracks.length ?? 0;
  }

  ngOnInit(): void {
    this.setupDragAndDrop();
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.setupResizeObserver();
    }
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId = suggestionId;
    this.cdr.markForCheck();
  }

  setupDragAndDrop(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.addEventListener(eventName, this.preventDefaultsFn, false);
      document.body.addEventListener(eventName, this.preventDefaultsFn, false);
    }
  }

  preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  @HostListener('dragenter', ['$event'])
  onDragEnter(e: DragEvent): void {
    if (e.dataTransfer?.types.includes('Files')) {
      this.showDropZone = true;
      this.cdr.markForCheck();
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(e: DragEvent): void {
    const currentTarget = e.currentTarget as HTMLElement | null;
    const relatedTarget = e.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && !currentTarget.contains(relatedTarget)) {
      this.showDropZone = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(e: DragEvent): void {
    this.preventDefaults(e);
    this.showDropZone = false;
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      void this.handleFiles(Array.from(files));
    }
    this.cdr.markForCheck();
  }

  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      void this.handleFiles(Array.from(input.files));
      input.value = '';
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    const validFiles = files.filter(isMidiFile);

    if (validFiles.length === 0) {
      this.errorMessage = 'Please select a valid MIDI file (.mid or .midi).';
      this.dismissedSuggestionId = null;
      this.toast.error('No supported MIDI files found');
      this.cdr.markForCheck();
      return;
    }

    await this.loadMidiFile(validFiles[0]!);
  }

  async loadMidiFile(file: File): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.cdr.markForCheck();

    try {
      const buffer = await file.arrayBuffer();
      this.midiData = parseMidiFile(buffer);
      this.fileName = file.name;
      this.fileSize = file.size;
      this.cdr.markForCheck();
      requestAnimationFrame(() => this.redrawPianoRoll());
    } catch (error) {
      this.midiData = null;
      this.fileName = '';
      this.fileSize = 0;
      this.errorMessage = `Failed to parse MIDI: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.toast.error('Failed to parse MIDI file');
    } finally {
      this.loading = false;
      this.cdr.markForCheck();
    }
  }

  redrawPianoRoll(): void {
    if (!this.pianoRollCanvas?.nativeElement || !this.midiData) {
      return;
    }

    drawMidiPianoRoll(
      this.pianoRollCanvas.nativeElement,
      this.midiData.notes,
      this.midiData.durationTicks
    );
  }

  clearAll(): void {
    this.midiData = null;
    this.fileName = '';
    this.fileSize = 0;
    this.errorMessage = '';
    this.dismissedSuggestionId = null;
    this.toast.info('MIDI file cleared');
    this.cdr.markForCheck();
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private setupResizeObserver(): void {
    if (!this.pianoRollCanvas?.nativeElement || typeof ResizeObserver === 'undefined') {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => this.redrawPianoRoll());
    this.resizeObserver.observe(this.pianoRollCanvas.nativeElement);
  }

  private cleanup(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    for (const eventName of ['dragenter', 'dragover', 'dragleave', 'drop']) {
      document.removeEventListener(eventName, this.preventDefaultsFn, false);
      document.body.removeEventListener(eventName, this.preventDefaultsFn, false);
    }
  }
}
