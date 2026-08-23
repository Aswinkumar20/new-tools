import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navigation, TooltipDirective, AssetService, ToastService } from '@tools-workspace/features-home';
import {
  FQG_EMPTY_FORM,
  FQG_MIN_CARDS_FOR_QUIZ,
  FQG_NEXT_CARD_DELAY_MS,
  FQG_RELATED_TOOLS
} from '../../constants/flashcard-quiz-generator.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type {
  Flashcard,
  FlashcardFormGroup,
  QuizAnswer
} from '../../types/flashcard-quiz-generator.types';
import {
  computeQuizProgress,
  computeQuizStats,
  createFlashcard,
  createQuizAnswer,
  deleteFlashcardFromList,
  resolveFlashcardQuizSuggestion,
  updateFlashcardInList,
  validateFlashcardSides
} from '../../utils/flashcard-quiz-generator.utils';

@Component({
  selector: 'lib-flashcard-quiz-generator',
  standalone: true,
  templateUrl: './flashcard-quiz-generator.html',
  styleUrls: ['./flashcard-quiz-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class FlashcardQuizGeneratorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  readonly form: FlashcardFormGroup = this.fb.group({
    front: this.fb.control(FQG_EMPTY_FORM.front, { nonNullable: true }),
    back: this.fb.control(FQG_EMPTY_FORM.back, { nonNullable: true })
  });

  readonly flashcards = signal<Flashcard[]>([]);
  readonly quizMode = signal(false);
  readonly currentQuizIndex = signal<number | null>(null);
  readonly quizAnswers = signal<QuizAnswer[]>([]);
  readonly showAnswer = signal(false);
  readonly editingFlashcard = signal<string | null>(null);
  readonly errors = signal<string[]>([]);
  private readonly dismissedSuggestionId = signal<string | null>(null);

  private nextCardTimerId: ReturnType<typeof setTimeout> | null = null;

  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = FQG_RELATED_TOOLS;

  readonly currentFlashcard = computed(() => {
    const index = this.currentQuizIndex();
    const cards = this.flashcards();
    return index !== null && index >= 0 && index < cards.length ? cards[index] : null;
  });

  readonly quizProgress = computed(() =>
    computeQuizProgress(this.quizAnswers().length, this.flashcards().length)
  );

  readonly quizStats = computed(() => computeQuizStats(this.quizAnswers()));

  readonly hasFlashcards = computed(() => this.flashcards().length > 0);
  readonly canStartQuiz = computed(() => this.flashcards().length >= FQG_MIN_CARDS_FOR_QUIZ);
  readonly isQuizComplete = computed(
    () => this.quizMode() && this.quizAnswers().length >= this.flashcards().length
  );

  readonly primarySuggestion = computed(() => {
    const suggestion = resolveFlashcardQuizSuggestion({
      cardCount: this.flashcards().length,
      quizMode: this.quizMode(),
      isQuizComplete: this.isQuizComplete(),
      accuracy: this.quizStats().accuracy,
      answeredCount: this.quizAnswers().length
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  addFlashcard(): void {
    this.errors.set([]);
    const values = this.form.getRawValue();
    const validationError = validateFlashcardSides(values);
    if (validationError) {
      this.errors.set([validationError]);
      return;
    }
    this.flashcards.update((current) => [...current, createFlashcard(values)]);
    this.form.reset({ ...FQG_EMPTY_FORM });
    this.editingFlashcard.set(null);
  }

  editFlashcard(flashcard: Flashcard): void {
    this.form.patchValue({ front: flashcard.front, back: flashcard.back });
    this.editingFlashcard.set(flashcard.id);
    this.errors.set([]);
  }

  updateFlashcard(): void {
    this.errors.set([]);
    const values = this.form.getRawValue();
    const id = this.editingFlashcard();
    if (!id) {
      return;
    }
    const validationError = validateFlashcardSides(values);
    if (validationError) {
      this.errors.set([validationError]);
      return;
    }
    this.flashcards.update((current) => updateFlashcardInList(current, id, values));
    this.form.reset({ ...FQG_EMPTY_FORM });
    this.editingFlashcard.set(null);
  }

  deleteFlashcard(id: string): void {
    this.flashcards.update((current) => deleteFlashcardFromList(current, id));
    if (this.editingFlashcard() === id) {
      this.form.reset({ ...FQG_EMPTY_FORM });
      this.editingFlashcard.set(null);
    }
  }

  startQuiz(): void {
    if (!this.canStartQuiz()) {
      return;
    }
    this.quizMode.set(true);
    this.currentQuizIndex.set(0);
    this.quizAnswers.set([]);
    this.showAnswer.set(false);
    this.errors.set([]);
  }

  endQuiz(): void {
    this.clearNextCardTimer();
    this.quizMode.set(false);
    this.currentQuizIndex.set(null);
    this.showAnswer.set(false);
  }

  nextCard(): void {
    const current = this.currentQuizIndex();
    if (current === null) {
      return;
    }
    const next = current + 1;
    if (next >= this.flashcards().length) {
      this.endQuiz();
    } else {
      this.currentQuizIndex.set(next);
      this.showAnswer.set(false);
    }
  }

  submitAnswer(correct: boolean): void {
    const card = this.currentFlashcard();
    if (!card) {
      return;
    }
    this.quizAnswers.update((answers) => [...answers, createQuizAnswer(card.id, correct)]);
    this.showAnswer.set(false);
    this.clearNextCardTimer();
    this.nextCardTimerId = setTimeout(() => {
      this.nextCardTimerId = null;
      this.nextCard();
    }, FQG_NEXT_CARD_DELAY_MS);
  }

  toggleAnswer(): void {
    this.showAnswer.update((show) => !show);
  }

  cancelEdit(): void {
    this.form.reset({ ...FQG_EMPTY_FORM });
    this.editingFlashcard.set(null);
    this.errors.set([]);
  }

  clearAll(): void {
    this.flashcards.set([]);
    this.quizAnswers.set([]);
    this.endQuiz();
    this.cancelEdit();
  }

  async copyFront(): Promise<void> {
    await ftCopyText(this.toast, this.form.controls.front.value, 'Front');
  }

  async copyBack(): Promise<void> {
    await ftCopyText(this.toast, this.form.controls.back.value, 'Back');
  }

  async copyCurrentAnswer(): Promise<void> {
    const card = this.currentFlashcard();
    if (!card) {
      return;
    }
    await ftCopyText(this.toast, card.back, 'Answer');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  ngOnDestroy(): void {
    this.clearNextCardTimer();
  }

  private clearNextCardTimer(): void {
    if (this.nextCardTimerId !== null) {
      clearTimeout(this.nextCardTimerId);
      this.nextCardTimerId = null;
    }
  }
}
