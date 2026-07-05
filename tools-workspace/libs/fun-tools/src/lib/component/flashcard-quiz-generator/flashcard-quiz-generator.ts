import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';

interface Flashcard {
  id: string;
  front: string;
  back: string;
  createdAt: number;
}

interface QuizAnswer {
  flashcardId: string;
  correct: boolean;
  timestamp: number;
}

type FlashcardFormGroup = FormGroup<{
  front: FormControl<string>;
  back: FormControl<string>;
}>;

@Component({
  selector: 'lib-flashcard-quiz-generator',
  standalone: true,
  templateUrl: './flashcard-quiz-generator.html',
  styleUrls: ['./flashcard-quiz-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlashcardQuizGeneratorComponent {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);

  readonly form: FlashcardFormGroup = this.fb.group({
    front: this.fb.control('', { nonNullable: true }),
    back: this.fb.control('', { nonNullable: true })
  });

  readonly flashcards = signal<Flashcard[]>([]);
  readonly quizMode = signal(false);
  readonly currentQuizIndex = signal<number | null>(null);
  readonly quizAnswers = signal<QuizAnswer[]>([]);
  readonly showAnswer = signal(false);
  readonly editingFlashcard = signal<string | null>(null);
  readonly errors = signal<string[]>([]);

  readonly currentFlashcard = computed(() => {
    const index = this.currentQuizIndex();
    const cards = this.flashcards();
    return index !== null && index >= 0 && index < cards.length ? cards[index] : null;
  });

  readonly quizProgress = computed(() => {
    const total = this.flashcards().length;
    const answered = this.quizAnswers().length;
    return total > 0 ? Math.round((answered / total) * 100) : 0;
  });

  readonly quizStats = computed(() => {
    const answers = this.quizAnswers();
    const correct = answers.filter((a) => a.correct).length;
    const total = answers.length;
    return { total, correct, incorrect: total - correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0 };
  });

  readonly hasFlashcards = computed(() => this.flashcards().length > 0);
  readonly canStartQuiz = computed(() => this.flashcards().length >= 2);
  readonly isQuizComplete = computed(() => this.quizMode() && this.quizAnswers().length >= this.flashcards().length);

  addFlashcard(): void {
    this.errors.set([]);
    const { front, back } = this.form.getRawValue();
    if (!front.trim()) { this.errors.set(['Front side cannot be empty.']); return; }
    if (!back.trim()) { this.errors.set(['Back side cannot be empty.']); return; }
    const flashcard: Flashcard = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      front: front.trim(), back: back.trim(), createdAt: Date.now()
    };
    this.flashcards.update((current) => [...current, flashcard]);
    this.form.reset({ front: '', back: '' });
    this.editingFlashcard.set(null);
  }

  editFlashcard(flashcard: Flashcard): void {
    this.form.patchValue({ front: flashcard.front, back: flashcard.back });
    this.editingFlashcard.set(flashcard.id);
    this.errors.set([]);
  }

  updateFlashcard(): void {
    this.errors.set([]);
    const { front, back } = this.form.getRawValue();
    const id = this.editingFlashcard();
    if (!id) return;
    if (!front.trim()) { this.errors.set(['Front side cannot be empty.']); return; }
    if (!back.trim()) { this.errors.set(['Back side cannot be empty.']); return; }
    this.flashcards.update((current) =>
      current.map((card) => card.id === id ? { ...card, front: front.trim(), back: back.trim() } : card)
    );
    this.form.reset({ front: '', back: '' });
    this.editingFlashcard.set(null);
  }

  deleteFlashcard(id: string): void {
    this.flashcards.update((current) => current.filter((card) => card.id !== id));
    if (this.editingFlashcard() === id) {
      this.form.reset({ front: '', back: '' });
      this.editingFlashcard.set(null);
    }
  }

  startQuiz(): void {
    if (!this.canStartQuiz()) return;
    this.quizMode.set(true);
    this.currentQuizIndex.set(0);
    this.quizAnswers.set([]);
    this.showAnswer.set(false);
    this.errors.set([]);
  }

  endQuiz(): void {
    this.quizMode.set(false);
    this.currentQuizIndex.set(null);
    this.showAnswer.set(false);
  }

  nextCard(): void {
    const current = this.currentQuizIndex();
    if (current === null) return;
    const next = current + 1;
    if (next >= this.flashcards().length) this.endQuiz();
    else { this.currentQuizIndex.set(next); this.showAnswer.set(false); }
  }

  submitAnswer(correct: boolean): void {
    const card = this.currentFlashcard();
    if (!card) return;
    this.quizAnswers.update((answers) => [...answers, { flashcardId: card.id, correct, timestamp: Date.now() }]);
    this.showAnswer.set(false);
    setTimeout(() => this.nextCard(), 500);
  }

  toggleAnswer(): void { this.showAnswer.update((show) => !show); }

  cancelEdit(): void {
    this.form.reset({ front: '', back: '' });
    this.editingFlashcard.set(null);
    this.errors.set([]);
  }

  clearAll(): void {
    this.flashcards.set([]);
    this.quizAnswers.set([]);
    this.endQuiz();
    this.cancelEdit();
  }

  copyFront(): void { this.copyText(this.form.controls.front.value, 'Front'); }
  copyBack(): void { this.copyText(this.form.controls.back.value, 'Back'); }
  copyCurrentAnswer(): void {
    const card = this.currentFlashcard();
    if (!card) return;
    this.copyText(card.back, 'Answer');
  }

  private copyText(text: string, label: string): void {
    if (!text.trim()) return;
    navigator.clipboard.writeText(text).then(() => alert(`${label} copied to clipboard!`));
  }
}
