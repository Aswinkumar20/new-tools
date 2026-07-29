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
  RNG_DEFAULT_OPTIONS,
  RNG_ERROR_COPY,
  RNG_RELATED_TOOLS
} from '../../constants/random-number-generator.constants';
import { ftCopyText } from '../../shared/ft-clipboard.util';
import type { FtRelatedToolLink } from '../../shared/ft-tool-suggestion.model';
import type {
  GeneratedNumber,
  RandomFormGroup,
  RandomNumberOptions
} from '../../types/random-number-generator.types';
import {
  computeRandomNumberStats,
  formatRandomNumber,
  formatResultsText,
  generateRandomNumbers,
  prependGeneratedHistory,
  resolveRandomNumberSuggestion,
  validateRandomNumberOptions
} from '../../utils/random-number-generator.utils';

@Component({
  selector: 'lib-random-number-generator',
  standalone: true,
  templateUrl: './random-number-generator.html',
  styleUrls: ['./random-number-generator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RandomNumberGeneratorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private formSubscription?: Subscription;

  readonly form: RandomFormGroup = this.fb.group({
    min: this.fb.control(RNG_DEFAULT_OPTIONS.min, { nonNullable: true }),
    max: this.fb.control(RNG_DEFAULT_OPTIONS.max, { nonNullable: true }),
    count: this.fb.control(RNG_DEFAULT_OPTIONS.count, { nonNullable: true }),
    integerOnly: this.fb.control(RNG_DEFAULT_OPTIONS.integerOnly, { nonNullable: true }),
    decimals: this.fb.control(RNG_DEFAULT_OPTIONS.decimals, { nonNullable: true })
  });

  readonly generatedNumbers = signal<GeneratedNumber[]>([]);
  readonly errors = signal<string[]>([]);
  readonly formSnapshot = signal<RandomNumberOptions>(this.form.getRawValue());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly relatedTools: ReadonlyArray<FtRelatedToolLink> = RNG_RELATED_TOOLS;

  readonly hasResults = computed(() => this.generatedNumbers().length > 0);
  readonly stats = computed(() => computeRandomNumberStats(this.generatedNumbers()));

  readonly latestResults = computed(() => {
    const count = this.formSnapshot().count;
    return this.generatedNumbers().slice(0, count);
  });

  readonly resultsText = computed(() => {
    const { integerOnly, decimals } = this.formSnapshot();
    return formatResultsText(this.latestResults(), integerOnly, decimals);
  });

  readonly primarySuggestion = computed(() => {
    const snapshot = this.formSnapshot();
    const suggestion = resolveRandomNumberSuggestion({
      hasResults: this.hasResults(),
      hasError: this.errors().length > 0,
      min: snapshot.min,
      max: snapshot.max,
      count: snapshot.count,
      integerOnly: snapshot.integerOnly
    });
    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.formSubscription = new Subscription();
    this.formSubscription.add(
      this.form.controls.integerOnly.valueChanges.subscribe((isInteger) => {
        if (isInteger) {
          this.form.controls.decimals.setValue(0);
        }
      })
    );
    this.formSubscription.add(
      this.form.valueChanges.subscribe(() => {
        this.formSnapshot.set(this.form.getRawValue());
      })
    );
  }

  generate(): void {
    this.errors.set([]);
    const options = this.form.getRawValue();
    this.formSnapshot.set(options);

    const validationError = validateRandomNumberOptions(options);
    if (validationError) {
      this.errors.set([validationError]);
      return;
    }

    const numbers = generateRandomNumbers(options);
    this.generatedNumbers.update((current) => prependGeneratedHistory(current, numbers));
  }

  clearResults(): void {
    this.generatedNumbers.set([]);
    this.errors.set([]);
  }

  async copyResults(): Promise<void> {
    const text = this.resultsText();
    if (!text) {
      return;
    }
    const copied = await ftCopyText(this.toast, text, 'Results');
    if (!copied) {
      this.errors.set([RNG_ERROR_COPY]);
    }
  }

  async copySingle(value: number): Promise<void> {
    const { integerOnly, decimals } = this.form.getRawValue();
    const text = formatRandomNumber(value, integerOnly, decimals);
    const copied = await ftCopyText(this.toast, text, 'Number');
    if (!copied) {
      this.errors.set([RNG_ERROR_COPY]);
    }
  }

  formatNumber(value: number): string {
    const { integerOnly, decimals } = this.form.getRawValue();
    return formatRandomNumber(value, integerOnly, decimals);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  ngOnDestroy(): void {
    this.formSubscription?.unsubscribe();
  }
}
