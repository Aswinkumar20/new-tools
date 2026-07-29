import { FormControl, FormGroup } from '@angular/forms';

export interface Flashcard {
  id: string;
  front: string;
  back: string;
  createdAt: number;
}

export interface QuizAnswer {
  flashcardId: string;
  correct: boolean;
  timestamp: number;
}

export interface QuizStats {
  total: number;
  correct: number;
  incorrect: number;
  accuracy: number;
}

export type FlashcardFormGroup = FormGroup<{
  front: FormControl<string>;
  back: FormControl<string>;
}>;

export interface FlashcardSideValues {
  front: string;
  back: string;
}
