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
import { Subscription } from 'rxjs';
import {
  LOREM_DEFAULT_OPTIONS,
  LOREM_ERROR_COPY_FAILED,
  LOREM_RELATED_TOOLS
} from '../../constants/lorem-ipsum-generator.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type {
  LoremFormGroup,
  LoremGenerateOptions
} from '../../types/lorem-ipsum-generator.types';
import {
  computeLoremStats,
  generateLoremText,
  maxCountForType,
  resolveLoremSuggestion,
  validateLoremCount
} from '../../utils/lorem-ipsum-generator.utils';

@Component({
  selector: 'lib-lorem-ipsum-generator',
  standalone: true,
  templateUrl: './lorem-ipsum-generator.html',
  styleUrls: ['./lorem-ipsum-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoremIpsumGeneratorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private formSubscription?: Subscription;

  readonly form: LoremFormGroup = this.fb.group({
    type: this.fb.control(LOREM_DEFAULT_OPTIONS.type, { nonNullable: true }),
    count: this.fb.control(LOREM_DEFAULT_OPTIONS.count, { nonNullable: true }),
    startWith: this.fb.control(LOREM_DEFAULT_OPTIONS.startWith, { nonNullable: true })
  });

  readonly generatedText = signal<string>('');
  readonly errors = signal<string[]>([]);
  readonly formSnapshot = signal<LoremGenerateOptions>(this.form.getRawValue());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = LOREM_RELATED_TOOLS;

  readonly stats = computed(() => computeLoremStats(this.generatedText()));
  readonly hasGeneratedText = computed(() => this.generatedText().length > 0);
  readonly countMax = computed(() => maxCountForType(this.formSnapshot().type));

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    const stats = this.stats();
    const suggestion = resolveLoremSuggestion({
      hasText: this.hasGeneratedText(),
      hasError: this.errors().length > 0,
      type: snapshot.type,
      characterCount: stats.characters,
      wordCount: stats.words
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.formSubscription = this.form.valueChanges.subscribe(() => {
      this.formSnapshot.set(this.form.getRawValue());
    });
    this.generate();
  }

  generate(): void {
    this.errors.set([]);
    const options = this.form.getRawValue();
    this.formSnapshot.set(options);

    const validationError = validateLoremCount(options.type, options.count);
    if (validationError) {
      this.errors.set([validationError]);
      return;
    }

    this.generatedText.set(generateLoremText(options));
  }

  async copyToClipboard(): Promise<void> {
    const text = this.generatedText();
    if (!text) {
      return;
    }
    const copied = await ftCopyText(this.toast, text, 'Generated text');
    if (!copied) {
      this.errors.set([LOREM_ERROR_COPY_FAILED]);
    }
  }

  clearText(): void {
    this.generatedText.set('');
    this.errors.set([]);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }
}
