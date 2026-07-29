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
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import {
  TYPING_RELATED_TOOLS,
  TYPING_SAMPLE_TEXTS,
  TYPING_TICK_MS
} from '../../constants/typing-speed-test.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type { TypingTestResult } from '../../types/typing-speed-test.types';
import {
  computeAverageWpm,
  computeBestWpm,
  computeTypingLiveStats,
  createTypingTestResult,
  formatTypingClock,
  formatTypingResultsSummary,
  isTypingPassageComplete,
  prependTypingResult,
  resolveTypingSuggestion,
  typingCharacterClassName
} from '../../utils/typing-speed-test.utils';

@Component({
  selector: 'lib-typing-speed-test',
  standalone: true,
  templateUrl: './typing-speed-test.html',
  styleUrls: ['./typing-speed-test.scss'],
  imports: [CommonModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TypingSpeedTestComponent implements OnDestroy {
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly sampleTexts: ReadonlyArray<string> = TYPING_SAMPLE_TEXTS;
  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = TYPING_RELATED_TOOLS;

  readonly currentText = signal<string>('');
  readonly typedText = signal<string>('');
  readonly isActive = signal(false);
  readonly isComplete = signal(false);
  readonly startTime = signal<number | null>(null);
  readonly elapsedTime = signal<number>(0);
  readonly testResults = signal<TypingTestResult[]>([]);
  readonly selectedTextIndex = signal(0);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  private intervalId: number | null = null;

  readonly currentStats = computed(() =>
    computeTypingLiveStats(this.typedText(), this.currentText(), this.elapsedTime())
  );

  readonly hasResults = computed(() => this.testResults().length > 0);
  readonly bestWPM = computed(() => computeBestWpm(this.testResults()));
  readonly averageWPM = computed(() => computeAverageWpm(this.testResults()));

  readonly resultsSummary = computed(() => formatTypingResultsSummary(this.testResults()));

  readonly primarySuggestion = computed(() => {
    const latest = this.testResults()[0];
    const suggestion = resolveTypingSuggestion({
      isActive: this.isActive(),
      isComplete: this.isComplete(),
      resultCount: this.testResults().length,
      latestWpm: latest?.wpm ?? this.currentStats().wpm,
      latestAccuracy: latest?.accuracy ?? this.currentStats().accuracy
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.loadText(0);
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  loadText(index: number): void {
    this.selectedTextIndex.set(index);
    this.currentText.set(TYPING_SAMPLE_TEXTS[index] ?? '');
    this.reset();
  }

  onInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    const value = input.value;

    if (!this.isActive() && value.length > 0) {
      this.start();
    }

    this.typedText.set(value);

    if (isTypingPassageComplete(value, this.currentText())) {
      this.complete();
    }
  }

  start(): void {
    this.isActive.set(true);
    this.isComplete.set(false);
    this.startTime.set(Date.now());
    this.elapsedTime.set(0);

    this.intervalId = window.setInterval(() => {
      const start = this.startTime();
      if (start) {
        this.elapsedTime.set((Date.now() - start) / 1000);
      }
    }, TYPING_TICK_MS);
  }

  complete(): void {
    this.stopTimer();
    this.isActive.set(false);
    this.isComplete.set(true);

    const result = createTypingTestResult(this.currentStats(), this.elapsedTime());
    this.testResults.update((results) => prependTypingResult(results, result));
  }

  reset(): void {
    this.stopTimer();
    this.typedText.set('');
    this.isActive.set(false);
    this.isComplete.set(false);
    this.startTime.set(null);
    this.elapsedTime.set(0);
  }

  stopTimer(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  getCharacterClass(index: number): string {
    return typingCharacterClassName(index, this.typedText(), this.currentText());
  }

  formatTime(seconds: number): string {
    return formatTypingClock(seconds);
  }

  clearResults(): void {
    this.testResults.set([]);
  }

  async copyTypedText(): Promise<void> {
    await ftCopyText(this.toast, this.typedText(), 'Typed text');
  }

  async copyResults(): Promise<void> {
    await ftCopyText(this.toast, this.resultsSummary(), 'Results');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }
}
