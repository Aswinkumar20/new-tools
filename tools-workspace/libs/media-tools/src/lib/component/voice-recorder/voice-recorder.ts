import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Navigation,
  TooltipDirective,
  AssetService,
  ToastService
} from '@tools-workspace/features-home';
import type { MtRelatedToolLink } from '../../shared/mt-tool-suggestion.model';
import {
  VOICE_RECORDER_FFT_SIZE,
  VOICE_RECORDER_HISTORY_LIMIT,
  VOICE_RECORDER_RELATED_TOOLS,
  VOICE_RECORDER_TIMER_MS,
  VOICE_RECORDER_VISUALIZER_HEIGHTS
} from '../../constants/voice-recorder.constants';
import type { VoiceRecording } from '../../types/voice-recorder.types';
import {
  averageFrequencyLevel,
  buildVoiceRecording,
  buildVoiceRecordingDownloadName,
  computeVoiceRecorderStats,
  formatVoiceRecorderFileSize,
  formatVoiceRecorderTime,
  formatVoiceRecorderTimestamp,
  mapMicrophoneAccessError,
  prependVoiceRecordings,
  resolveVoiceRecorderStatus,
  resolveVoiceRecorderSuggestion
} from '../../utils/voice-recorder.utils';

@Component({
  selector: 'lib-voice-recorder',
  standalone: true,
  templateUrl: './voice-recorder.html',
  styleUrls: ['./voice-recorder.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VoiceRecorderComponent implements OnDestroy {
  readonly assetService = inject(AssetService);
  private readonly toast = inject(ToastService);

  readonly isRecording = signal(false);
  readonly isPaused = signal(false);
  readonly isPlaying = signal(false);
  readonly currentRecording = signal<VoiceRecording | null>(null);
  readonly recordings = signal<VoiceRecording[]>([]);
  readonly errors = signal<string[]>([]);
  readonly elapsedTime = signal<number>(0);
  readonly audioLevel = signal<number>(0);

  readonly relatedTools: ReadonlyArray<MtRelatedToolLink> = VOICE_RECORDER_RELATED_TOOLS;
  readonly visualizerHeights = VOICE_RECORDER_VISUALIZER_HEIGHTS;

  private readonly dismissedSuggestionId = signal<string | null>(null);

  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private startTime = 0;
  private timerInterval: number | null = null;
  private animationFrame: number | null = null;
  private audioElement: HTMLAudioElement | null = null;

  readonly hasRecordings = computed(() => this.recordings().length > 0);
  readonly hasCurrentRecording = computed(() => this.currentRecording() !== null);
  readonly formattedTime = computed(() => formatVoiceRecorderTime(this.elapsedTime()));

  readonly statusLabel = computed(() =>
    resolveVoiceRecorderStatus({
      isRecording: this.isRecording(),
      isPaused: this.isPaused(),
      isPlaying: this.isPlaying()
    })
  );

  readonly stats = computed(() => computeVoiceRecorderStats(this.recordings()));

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveVoiceRecorderSuggestion({
      hasRecordings: this.hasRecordings(),
      hasError: this.errors().length > 0,
      isRecording: this.isRecording(),
      errorMessage: this.errors()[0] ?? null
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  async startRecording(): Promise<void> {
    this.errors.set([]);
    this.dismissedSuggestionId.set(null);

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.audioChunks = [];

      this.audioContext = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = VOICE_RECORDER_FFT_SIZE;
      this.microphone = this.audioContext.createMediaStreamSource(this.stream);
      this.microphone.connect(this.analyser);

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = () => {
        this.finishRecording();
      };

      this.mediaRecorder.start();
      this.isRecording.set(true);
      this.isPaused.set(false);
      this.startTime = Date.now();
      this.elapsedTime.set(0);

      this.startTimer();
      this.startAudioVisualization();
      this.toast.info('Recording started');
    } catch (error) {
      this.errors.set([mapMicrophoneAccessError(error)]);
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.isRecording()) {
      this.mediaRecorder.stop();
      this.stopTimer();
      this.stopAudioVisualization();
      this.cleanupStream();
    }
  }

  pauseRecording(): void {
    if (this.mediaRecorder && this.isRecording() && !this.isPaused()) {
      this.mediaRecorder.pause();
      this.isPaused.set(true);
      this.stopTimer();
      this.stopAudioVisualization();
    }
  }

  resumeRecording(): void {
    if (this.mediaRecorder && this.isRecording() && this.isPaused()) {
      this.mediaRecorder.resume();
      this.isPaused.set(false);
      this.startTimer();
      this.startAudioVisualization();
    }
  }

  private finishRecording(): void {
    const recording = buildVoiceRecording({
      chunks: this.audioChunks,
      duration: this.elapsedTime()
    });

    this.currentRecording.set(recording);
    this.recordings.update((recordings) =>
      prependVoiceRecordings(recordings, recording, VOICE_RECORDER_HISTORY_LIMIT)
    );
    this.isRecording.set(false);
    this.isPaused.set(false);
    this.dismissedSuggestionId.set(null);
    this.toast.info('Recording saved');
  }

  private cleanupStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      void this.audioContext.close();
      this.audioContext = null;
    }
    this.analyser = null;
  }

  private startTimer(): void {
    this.timerInterval = window.setInterval(() => {
      if (!this.isPaused()) {
        this.elapsedTime.set((Date.now() - this.startTime) / 1000);
      } else {
        this.startTime = Date.now() - this.elapsedTime() * 1000;
      }
    }, VOICE_RECORDER_TIMER_MS);
  }

  private stopTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private startAudioVisualization(): void {
    if (!this.analyser) {
      return;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const updateLevel = (): void => {
      if (!this.analyser || !this.isRecording() || this.isPaused()) {
        this.audioLevel.set(0);
        return;
      }

      this.analyser.getByteFrequencyData(dataArray);
      this.audioLevel.set(averageFrequencyLevel(dataArray));
      this.animationFrame = requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  private stopAudioVisualization(): void {
    if (this.animationFrame !== null) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }
    this.audioLevel.set(0);
  }

  playRecording(recording: VoiceRecording): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement = null;
    }

    this.audioElement = new Audio(recording.audioUrl);
    this.audioElement.onplay = () => this.isPlaying.set(true);
    this.audioElement.onpause = () => this.isPlaying.set(false);
    this.audioElement.onended = () => {
      this.isPlaying.set(false);
      this.audioElement = null;
    };

    this.currentRecording.set(recording);
    void this.audioElement.play();
  }

  stopPlayback(): void {
    if (this.audioElement) {
      this.audioElement.pause();
      this.audioElement.currentTime = 0;
      this.audioElement = null;
      this.isPlaying.set(false);
    }
  }

  downloadRecording(recording: VoiceRecording): void {
    const link = document.createElement('a');
    link.href = recording.audioUrl;
    link.download = buildVoiceRecordingDownloadName(recording.timestamp);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toast.info(`Downloaded ${buildVoiceRecordingDownloadName(recording.timestamp)}`);
  }

  deleteRecording(id: string): void {
    const recording = this.recordings().find((r) => r.id === id);
    if (recording) {
      try {
        URL.revokeObjectURL(recording.audioUrl);
      } catch {
        // Ignore invalid object URLs during teardown
      }
    }

    this.recordings.update((recordings) => recordings.filter((r) => r.id !== id));

    if (this.currentRecording()?.id === id) {
      this.stopPlayback();
      this.currentRecording.set(null);
    }
    this.toast.info('Recording deleted');
  }

  clearAllRecordings(): void {
    this.recordings().forEach((recording) => {
      try {
        URL.revokeObjectURL(recording.audioUrl);
      } catch {
        // Ignore invalid object URLs during teardown
      }
    });
    this.recordings.set([]);
    this.stopPlayback();
    this.currentRecording.set(null);
    this.dismissedSuggestionId.set(null);
    this.toast.info('All recordings cleared');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  formatTime(seconds: number): string {
    return formatVoiceRecorderTime(seconds);
  }

  formatFileSize(bytes: number): string {
    return formatVoiceRecorderFileSize(bytes);
  }

  formatTimestamp(timestamp: number): string {
    return formatVoiceRecorderTimestamp(timestamp);
  }

  ngOnDestroy(): void {
    this.stopRecording();
    this.stopPlayback();
    this.cleanupStream();
    this.stopTimer();
    this.stopAudioVisualization();
    this.recordings().forEach((recording) => {
      try {
        URL.revokeObjectURL(recording.audioUrl);
      } catch {
        // Ignore invalid object URLs during teardown
      }
    });
  }
}
