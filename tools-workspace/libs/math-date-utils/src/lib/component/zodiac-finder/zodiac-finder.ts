import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  WritableSignal,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { debounceTime } from 'rxjs';
import {
  ZODIAC_DEFAULT_FORM,
  ZODIAC_HISTORY_LIMIT,
  ZODIAC_RELATED_TOOLS,
  ZODIAC_SIGNS,
  ZODIAC_TIMEZONES
} from '../../constants/zodiac-finder.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  ZodiacDatePreset,
  ZodiacFormGroup,
  ZodiacFormValues,
  ZodiacHistoryEntry,
  ZodiacResult
} from '../../types/zodiac-finder.types';
import {
  buildCompatibilityCards,
  buildSummaryCards,
  computeZodiac,
  createRandomBirthDate,
  formatDateInput,
  formatZodiacResultText,
  isoDateValidator,
  prependZodiacHistory,
  resolveZodiacPresetDate,
  resolveZodiacSuggestion
} from '../../utils/zodiac-finder.utils';

@Component({
  selector: 'lib-zodiac-finder',
  standalone: true,
  templateUrl: './zodiac-finder.html',
  styleUrls: ['./zodiac-finder.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ZodiacFinderComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private readonly destroyRef = inject(DestroyRef);

  readonly timezones = ZODIAC_TIMEZONES;
  readonly signs = ZODIAC_SIGNS;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = ZODIAC_RELATED_TOOLS;

  readonly form: ZodiacFormGroup = this.fb.group({
    birthDate: this.fb.control(ZODIAC_DEFAULT_FORM.birthDate, {
      validators: [Validators.required, isoDateValidator],
      nonNullable: true
    }),
    birthTime: this.fb.control<string | null>(ZODIAC_DEFAULT_FORM.birthTime),
    timezone: this.fb.control(ZODIAC_DEFAULT_FORM.timezone, {
      nonNullable: true,
      validators: [Validators.required]
    }),
    includeHistory: this.fb.control(ZODIAC_DEFAULT_FORM.includeHistory, {
      nonNullable: true
    })
  });

  readonly result: WritableSignal<ZodiacResult | null> = signal(null);
  readonly history: WritableSignal<ZodiacHistoryEntry[]> = signal([]);
  readonly formSnapshot = signal<ZodiacFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly hasHistory = computed(() => this.history().length > 0);
  readonly summaryCards = computed(() => buildSummaryCards(this.result()));
  readonly compatibilityCards = computed(() => buildCompatibilityCards(this.result()));

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const suggestion = resolveZodiacSuggestion({
      hasResult: current !== null,
      hasError: this.form.invalid && this.form.controls.birthDate.touched,
      hasCusp: Boolean(current?.cuspLabel),
      lifePathNumber: current?.lifePathNumber ?? null,
      sunSignName: current?.sunSign.name ?? null,
      birthDate: this.formSnapshot().birthDate
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.form.valueChanges
      .pipe(debounceTime(120), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.formSnapshot.set(this.readFormValues());
        this.recalculateZodiac();
      });

    this.recalculateZodiac();
  }

  preset(date: ZodiacDatePreset): void {
    this.form.patchValue({ birthDate: resolveZodiacPresetDate(date) });
    this.toast.info(
      date === 'today'
        ? 'Jumped to today.'
        : date === 'yesterday'
          ? 'Jumped to yesterday.'
          : 'Jumped to New Year’s Day.'
    );
  }

  randomize(): void {
    this.form.patchValue({ birthDate: formatDateInput(createRandomBirthDate()) });
    this.toast.info('Surprise birth date applied.');
  }

  applyHistory(entry: ZodiacHistoryEntry): void {
    this.form.patchValue({ birthDate: entry.birthDate });
    this.toast.info('History entry restored.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.toast.info('History cleared.');
  }

  async copyResult(): Promise<void> {
    const current = this.result();
    if (!current) {
      return;
    }
    await mdCopyText(this.toast, formatZodiacResultText(current), 'Result');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  private readFormValues(): ZodiacFormValues {
    const raw = this.form.getRawValue();
    return {
      birthDate: raw.birthDate,
      birthTime: raw.birthTime,
      timezone: raw.timezone,
      includeHistory: raw.includeHistory
    };
  }

  private recalculateZodiac(): void {
    if (this.form.invalid) {
      this.result.set(null);
      return;
    }

    const { birthDate, birthTime, timezone, includeHistory } = this.form.getRawValue();
    if (!birthDate || !timezone) {
      this.result.set(null);
      return;
    }

    const calculation = computeZodiac(birthDate, birthTime ?? undefined, timezone);
    this.result.set(calculation);

    if (includeHistory && calculation) {
      this.history.update((entries) =>
        prependZodiacHistory(
          entries,
          {
            birthDate: calculation.birthDate,
            sunSign: calculation.sunSign.name,
            chineseAnimal: calculation.chineseAnimal.animal,
            recordedAt: Date.now()
          },
          ZODIAC_HISTORY_LIMIT
        )
      );
    }
  }
}
