import { FormControl, FormGroup } from '@angular/forms';

export type LoremGenerationType = 'paragraphs' | 'words' | 'sentences';
export type LoremStartWith = 'lorem' | 'random';

export type LoremFormGroup = FormGroup<{
  type: FormControl<LoremGenerationType>;
  count: FormControl<number>;
  startWith: FormControl<LoremStartWith>;
}>;

export interface LoremGenerateOptions {
  type: LoremGenerationType;
  count: number;
  startWith: LoremStartWith;
}

export interface LoremTextStats {
  words: number;
  characters: number;
  paragraphs: number;
  sentences: number;
}
