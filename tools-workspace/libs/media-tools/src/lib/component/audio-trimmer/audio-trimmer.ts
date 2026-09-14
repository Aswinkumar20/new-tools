import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Navigation,
  TooltipDirective,
  AssetService,
  ToastService
} from '@tools-workspace/features-home';
import type { MtRelatedToolLink } from '../../shared/mt-tool-suggestion.model';
import {
  AUDIO_TRIMMER_ACCEPT_ATTR,
  AUDIO_TRIMMER_DESCRIPTION,
  AUDIO_TRIMMER_EXPORT_FORMATS,
  AUDIO_TRIMMER_FORMATS_LABEL,
  AUDIO_TRIMMER_HELP_ITEMS,
  AUDIO_TRIMMER_INFO_ITEMS,
  AUDIO_TRIMMER_RELATED_TOOLS,
  AUDIO_TRIMMER_TITLE,
  AUDIO_TRIMMER_UPLOAD_HINT,
  AUDIO_TRIMMER_UPLOAD_LABEL
} from '../../constants/audio-trimmer.constants';
import type { AudioTrimmerExportFormat, AudioTrimmerInfoItem } from '../../types/audio-trimmer.types';
import {
  clampTrimRange,
  formatAudioTrimmerFileSize,
  formatTrimTimestamp,
  resolveAudioTrimmerSuggestion,
  validateAudioTrimmerFiles
} from '../../utils/audio-trimmer.utils';
import {
  AUDIO_TRIMMER_WAVEFORM_BARS,
  audioBufferToMp3Blob,
  audioBufferToWavBlob,
  buildTrimmedFileName,
  computeWaveformPeaks,
  decodeAudioFile,
  drawWaveformWithSelection,
  extractTrimmedBuffer,
  nearestTrimHandle,
  parseTrimTimestampInput,
  ratioFromClientX,
  type TrimHandle
} from '../../utils/audio-trimmer-process.utils';

@Component({
  selector: 'lib-audio-trimmer',
  standalone: true,
  templateUrl: './audio-trimmer.html',
  styleUrls: ['./audio-trimmer.scss'],
  imports: [CommonModule, FormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AudioTrimmerComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  @ViewChild('waveformCanvas') waveformCanvas?: ElementRef<HTMLCanvasElement>;
  @ViewChild('fileInput') fileInput?: ElementRef<HTMLInputElement>;

  readonly title = AUDIO_TRIMMER_TITLE;
  readonly description = AUDIO_TRIMMER_DESCRIPTION;
  readonly uploadLabel = AUDIO_TRIMMER_UPLOAD_LABEL;
  readonly uploadHint = AUDIO_TRIMMER_UPLOAD_HINT;
  readonly acceptAttr = AUDIO_TRIMMER_ACCEPT_ATTR;
  readonly formatsLabel = AUDIO_TRIMMER_FORMATS_LABEL;
  readonly exportFormats: ReadonlyArray<AudioTrimmerExportFormat> = AUDIO_TRIMMER_EXPORT_FORMATS;
  readonly helpItems = AUDIO_TRIMMER_HELP_ITEMS;
  readonly infoItems: ReadonlyArray<AudioTrimmerInfoItem> = AUDIO_TRIMMER_INFO_ITEMS;
  readonly relatedTools: ReadonlyArray<MtRelatedToolLink> = AUDIO_TRIMMER_RELATED_TOOLS;

  readonly sourceFile = signal<File | null>(null);
  readonly audioBuffer = signal<AudioBuffer | null>(null);
  readonly waveformPeaks = signal<number[]>([]);
  readonly durationSeconds = signal(0);
  readonly startSeconds = signal(0);
  readonly endSeconds = signal(0);
  readonly startInput = signal('0:00.000');
  readonly endInput = signal('0:00.000');
  readonly fadeInSeconds = signal(0);
  readonly fadeOutSeconds = signal(0);
  readonly selectedExportId = signal(AUDIO_TRIMMER_EXPORT_FORMATS[0].id);
  readonly isLoading = signal(false);
  readonly isExporting = signal(false);
  readonly isPreviewPlaying = signal(false);
  readonly errors = signal<string[]>([]);
  readonly showDropZone = signal(false);
  readonly lastExportLabel = signal('—');

  private readonly dismissedSuggestionId = signal<string | null>(null);
  private previewContext: AudioContext | null = null;
  private previewSource: AudioBufferSourceNode | null = null;
  private previewStartTime = 0;
  private previewAnimationFrame: number | null = null;
  private dragHandle: TrimHandle | null = null;

  readonly hasSource = computed(() => this.sourceFile() !== null);
  readonly trimDurationSeconds = computed(() =>
    Math.max(0, this.endSeconds() - this.startSeconds())
  );
  readonly statusLabel = computed(() => {
    if (this.isExporting()) {
      return 'Exporting';
    }
    if (this.isPreviewPlaying()) {
      return 'Preview';
    }
    if (this.isLoading()) {
      return 'Loading';
    }
    return this.hasSource() ? 'Ready' : 'Idle';
  });

  readonly selectedExportFormat = computed(
    () =>
      this.exportFormats.find((f) => f.id === this.selectedExportId()) ?? this.exportFormats[0]
  );

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveAudioTrimmerSuggestion({ isComingSoon: false });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  ngOnDestroy(): void {
    this.stopPreview();
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
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

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent): void {
    if (event.dataTransfer?.types.includes('Files')) {
      this.showDropZone.set(true);
    }
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    const currentTarget = event.currentTarget as HTMLElement | null;
    const relatedTarget = event.relatedTarget as Node | null;
    if (currentTarget && relatedTarget && !currentTarget.contains(relatedTarget)) {
      this.showDropZone.set(false);
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.showDropZone.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      void this.handleFiles(Array.from(files));
    }
  }

  async handleFiles(files: File[]): Promise<void> {
    const { validFiles, errors } = validateAudioTrimmerFiles(files);
    if (errors.length) {
      this.errors.set(errors);
      this.toast.error(errors[0] ?? 'Invalid file');
      return;
    }
    if (!validFiles.length) {
      return;
    }

    await this.loadFile(validFiles[0]);
  }

  async loadFile(file: File): Promise<void> {
    this.isLoading.set(true);
    this.errors.set([]);
    this.dismissedSuggestionId.set(null);
    this.stopPreview();

    try {
      const buffer = await decodeAudioFile(file);
      const duration = buffer.duration;
      const peaks = computeWaveformPeaks(buffer, AUDIO_TRIMMER_WAVEFORM_BARS);

      this.sourceFile.set(file);
      this.audioBuffer.set(buffer);
      this.waveformPeaks.set(peaks);
      this.durationSeconds.set(duration);
      this.startSeconds.set(0);
      this.endSeconds.set(duration);
      this.startInput.set(formatTrimTimestamp(0));
      this.endInput.set(formatTrimTimestamp(duration));
      this.lastExportLabel.set('—');
      this.toast.success(`Loaded ${file.name}`);

      requestAnimationFrame(() => this.redrawWaveform());
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to decode audio';
      this.errors.set([message]);
      this.toast.error(message);
    } finally {
      this.isLoading.set(false);
    }
  }

  clearSource(): void {
    this.stopPreview();
    this.sourceFile.set(null);
    this.audioBuffer.set(null);
    this.waveformPeaks.set([]);
    this.durationSeconds.set(0);
    this.startSeconds.set(0);
    this.endSeconds.set(0);
    this.errors.set([]);
    this.lastExportLabel.set('—');
  }

  onStartInputCommit(): void {
    this.commitTimeInput('start', this.startInput());
  }

  onEndInputCommit(): void {
    this.commitTimeInput('end', this.endInput());
  }

  commitTimeInput(which: 'start' | 'end', value: string): void {
    const parsed = parseTrimTimestampInput(value);
    if (parsed == null) {
      this.toast.error('Invalid time format');
      this.syncTimeInputs();
      return;
    }

    const duration = this.durationSeconds();
    const nextStart = which === 'start' ? parsed : this.startSeconds();
    const nextEnd = which === 'end' ? parsed : this.endSeconds();
    const clamped = clampTrimRange(nextStart, nextEnd, duration);
    const minGap = 0.01;
    if (clamped.endSeconds - clamped.startSeconds < minGap) {
      this.toast.error('Selection must be at least 10 ms');
      this.syncTimeInputs();
      return;
    }

    this.startSeconds.set(clamped.startSeconds);
    this.endSeconds.set(clamped.endSeconds);
    this.syncTimeInputs();
    this.redrawWaveform();
  }

  syncTimeInputs(): void {
    this.startInput.set(formatTrimTimestamp(this.startSeconds()));
    this.endInput.set(formatTrimTimestamp(this.endSeconds()));
  }

  onWaveformPointerDown(event: PointerEvent): void {
    const canvas = this.waveformCanvas?.nativeElement;
    if (!canvas || !this.hasSource()) {
      return;
    }

    const ratio = ratioFromClientX(canvas, event.clientX);
    const startRatio = this.startSeconds() / this.durationSeconds();
    const endRatio = this.endSeconds() / this.durationSeconds();
    this.dragHandle = nearestTrimHandle(ratio, startRatio, endRatio) ?? (ratio < startRatio ? 'start' : 'end');
    canvas.setPointerCapture(event.pointerId);
    this.applyRatioToHandle(ratio);
  }

  onWaveformPointerMove(event: PointerEvent): void {
    if (!this.dragHandle) {
      return;
    }
    const canvas = this.waveformCanvas?.nativeElement;
    if (!canvas) {
      return;
    }
    this.applyRatioToHandle(ratioFromClientX(canvas, event.clientX));
  }

  onWaveformPointerUp(event: PointerEvent): void {
    const canvas = this.waveformCanvas?.nativeElement;
    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    this.dragHandle = null;
  }

  private applyRatioToHandle(ratio: number): void {
    const duration = this.durationSeconds();
    const seconds = ratio * duration;

    if (this.dragHandle === 'start') {
      const clamped = clampTrimRange(seconds, this.endSeconds(), duration);
      if (clamped.endSeconds - clamped.startSeconds < 0.01) {
        return;
      }
      this.startSeconds.set(clamped.startSeconds);
    } else if (this.dragHandle === 'end') {
      const clamped = clampTrimRange(this.startSeconds(), seconds, duration);
      if (clamped.endSeconds - clamped.startSeconds < 0.01) {
        return;
      }
      this.endSeconds.set(clamped.endSeconds);
    }

    this.syncTimeInputs();
    this.redrawWaveform();
  }

  redrawWaveform(playheadRatio: number | null = null): void {
    const canvas = this.waveformCanvas?.nativeElement;
    const peaks = this.waveformPeaks();
    const duration = this.durationSeconds();
    if (!canvas || !peaks.length || duration <= 0) {
      return;
    }

    drawWaveformWithSelection({
      canvas,
      peaks,
      startRatio: this.startSeconds() / duration,
      endRatio: this.endSeconds() / duration,
      playheadRatio
    });
  }

  async togglePreview(): Promise<void> {
    if (this.isPreviewPlaying()) {
      this.stopPreview();
      return;
    }
    await this.startPreview();
  }

  private async startPreview(): Promise<void> {
    const buffer = this.audioBuffer();
    if (!buffer) {
      return;
    }

    this.stopPreview(false);
    const trimmed = extractTrimmedBuffer(buffer, this.startSeconds(), this.endSeconds(), {
      fadeInSeconds: this.fadeInSeconds(),
      fadeOutSeconds: this.fadeOutSeconds()
    });

    this.previewContext = new AudioContext();
    this.previewSource = this.previewContext.createBufferSource();
    this.previewSource.buffer = trimmed;
    this.previewSource.connect(this.previewContext.destination);
    this.previewStartTime = this.previewContext.currentTime;
    this.previewSource.onended = () => this.stopPreview();
    this.previewSource.start(0);
    this.isPreviewPlaying.set(true);
    this.animatePreviewPlayhead(trimmed.duration);
  }

  private animatePreviewPlayhead(trimDuration: number): void {
    const start = this.startSeconds();
    const end = this.endSeconds();
    const duration = this.durationSeconds();

    const tick = () => {
      if (!this.isPreviewPlaying() || !this.previewContext) {
        return;
      }
      const elapsed = this.previewContext.currentTime - this.previewStartTime;
      const progress = trimDuration > 0 ? elapsed / trimDuration : 0;
      const current = start + progress * (end - start);
      const ratio = duration > 0 ? current / duration : 0;
      this.redrawWaveform(ratio);
      if (elapsed >= trimDuration) {
        this.stopPreview();
        return;
      }
      this.previewAnimationFrame = requestAnimationFrame(tick);
    };
    this.previewAnimationFrame = requestAnimationFrame(tick);
  }

  private stopPreview(resetPlayhead = true): void {
    if (this.previewAnimationFrame != null) {
      cancelAnimationFrame(this.previewAnimationFrame);
      this.previewAnimationFrame = null;
    }
    this.previewSource?.stop();
    this.previewSource?.disconnect();
    this.previewSource = null;
    void this.previewContext?.close();
    this.previewContext = null;
    this.isPreviewPlaying.set(false);
    if (resetPlayhead) {
      this.redrawWaveform();
    }
  }

  async exportTrimmed(): Promise<void> {
    const buffer = this.audioBuffer();
    const file = this.sourceFile();
    if (!buffer || !file) {
      return;
    }

    this.isExporting.set(true);
    this.stopPreview();

    try {
      const trimmed = extractTrimmedBuffer(buffer, this.startSeconds(), this.endSeconds(), {
        fadeInSeconds: this.fadeInSeconds(),
        fadeOutSeconds: this.fadeOutSeconds()
      });

      const format = this.selectedExportFormat();
      let blob: Blob;
      if (format.id === 'mp3') {
        blob = await audioBufferToMp3Blob(
          trimmed,
          this.assetService.getAssetPath('lamejs/lame.min.js')
        );
      } else {
        blob = audioBufferToWavBlob(trimmed);
      }

      const fileName = buildTrimmedFileName(file.name, format.extension);
      this.downloadBlob(blob, fileName);
      this.lastExportLabel.set(format.label);
      this.toast.success(`Exported ${format.label}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      this.toast.error(message);
    } finally {
      this.isExporting.set(false);
    }
  }

  private downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  formatFileSize(bytes: number): string {
    return formatAudioTrimmerFileSize(bytes);
  }

  formatTime(seconds: number): string {
    return formatTrimTimestamp(seconds);
  }
}
