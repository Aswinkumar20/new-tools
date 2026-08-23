import { ChangeDetectionStrategy, Component, OnDestroy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Navigation } from '@tools-workspace/features-home';

interface TestResult {
  wpm: number;
  accuracy: number;
  time: number;
  characters: number;
  correct: number;
  incorrect: number;
  timestamp: number;
}

const SAMPLE_TEXTS = [
  'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the alphabet.',
  'Programming is the art of telling a computer what to do through a series of instructions. It requires logic, creativity, and problem-solving skills.',
  'The internet has revolutionized how we communicate, work, and access information. It connects billions of people around the world.',
  'Learning to type efficiently is an essential skill in the digital age. Practice regularly to improve your speed and accuracy.',
  'Nature provides us with beauty, resources, and inspiration. We must protect and preserve our environment for future generations.',
  'Books are windows to different worlds, perspectives, and knowledge. Reading expands our minds and enriches our lives.',
  'Technology continues to evolve at a rapid pace, transforming industries and creating new opportunities for innovation and growth.',
  'Music has the power to evoke emotions, bring people together, and express ideas that words alone cannot convey.',
  'Travel broadens our horizons and helps us understand different cultures, traditions, and ways of life around the globe.',
  'Science helps us understand the world around us, from the smallest particles to the vastness of the universe.'
];

@Component({
  selector: 'lib-typing-speed-test',
  standalone: true,
  templateUrl: './typing-speed-test.html',
  styleUrls: ['./typing-speed-test.scss'],
  imports: [CommonModule, Navigation],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TypingSpeedTestComponent implements OnDestroy {
  readonly SAMPLE_TEXTS = SAMPLE_TEXTS;
  
  readonly currentText = signal<string>('');
  readonly typedText = signal<string>('');
  readonly isActive = signal(false);
  readonly isComplete = signal(false);
  readonly startTime = signal<number | null>(null);
  readonly elapsedTime = signal<number>(0);
  readonly testResults = signal<TestResult[]>([]);
  readonly selectedTextIndex = signal<number>(0);

  private intervalId: number | null = null;

  readonly currentStats = computed(() => {
    const typed = this.typedText();
    const text = this.currentText();
    const time = this.elapsedTime();

    if (!typed || !text || time === 0) {
      return { wpm: 0, accuracy: 0, characters: 0, correct: 0, incorrect: 0 };
    }

    const characters = typed.length;
    let correct = 0;
    let incorrect = 0;

    for (let i = 0; i < characters; i++) {
      if (i < text.length && typed[i] === text[i]) {
        correct++;
      } else {
        incorrect++;
      }
    }

    const words = typed.trim().split(/\s+/).filter((w) => w.length > 0).length;
    const minutes = time / 60;
    const wpm = minutes > 0 ? Math.round((words / minutes) * 60) : 0;
    const accuracy = characters > 0 ? Math.round((correct / characters) * 100) : 0;

    return { wpm, accuracy, characters, correct, incorrect };
  });

  readonly hasResults = computed(() => this.testResults().length > 0);
  readonly bestWPM = computed(() => {
    const results = this.testResults();
    return results.length > 0 ? Math.max(...results.map((r) => r.wpm)) : 0;
  });
  readonly averageWPM = computed(() => {
    const results = this.testResults();
    return results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.wpm, 0) / results.length)
      : 0;
  });

  constructor() {
    this.loadText(0);
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  loadText(index: number): void {
    this.selectedTextIndex.set(index);
    this.currentText.set(SAMPLE_TEXTS[index]);
    this.reset();
  }

  onInput(event: Event): void {
    const input = event.target as HTMLTextAreaElement;
    const value = input.value;

    if (!this.isActive() && value.length > 0) {
      this.start();
    }

    this.typedText.set(value);

    // Check if test is complete
    if (value.length >= this.currentText().length) {
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
    }, 100);
  }

  complete(): void {
    this.stopTimer();
    this.isActive.set(false);
    this.isComplete.set(true);

    const stats = this.currentStats();
    const result: TestResult = {
      wpm: stats.wpm,
      accuracy: stats.accuracy,
      time: this.elapsedTime(),
      characters: stats.characters,
      correct: stats.correct,
      incorrect: stats.incorrect,
      timestamp: Date.now()
    };

    this.testResults.update((results) => [result, ...results].slice(0, 10));
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
    const typed = this.typedText();
    const text = this.currentText();

    if (index >= typed.length) {
      return '';
    }

    if (index >= text.length) {
      return 'tst__char--incorrect';
    }

    return typed[index] === text[index] ? 'tst__char--correct' : 'tst__char--incorrect';
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  clearResults(): void {
    this.testResults.set([]);
  }
}
