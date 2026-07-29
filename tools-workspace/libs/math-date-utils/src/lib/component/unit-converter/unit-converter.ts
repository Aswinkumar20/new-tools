import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import {
  catchError,
  debounceTime,
  defer,
  distinctUntilChanged,
  map,
  Observable,
  of,
  startWith,
  switchMap,
  tap
} from 'rxjs';
import {
  BASE_UNITS,
  CATEGORY_DEFINITIONS,
  QUICK_SHORTCUTS,
  UNIT_CONVERTER_DEFAULT_CATEGORY,
  UNIT_CONVERTER_DEFAULT_PRESETS,
  UNIT_CONVERTER_RELATED_TOOLS
} from '../../constants/unit-converter.constants';
import {
  UNIT_DEFINITIONS,
  UNIT_INDEXES,
  UNITS_BY_TYPE
} from '../../constants/unit-converter.units';
import { createMockCurrencyRateService } from '../../services/unit-converter-currency.service';
import { ConversionHistoryStore } from '../../services/unit-converter-history.store';
import { PresetStore } from '../../services/unit-converter-preset.store';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  CategoryDefinition,
  ConversionPreset,
  ConversionResult,
  QuickConversionShortcut,
  UnitDefinition,
  UnitType
} from '../../types/unit-converter.types';
import {
  createDefaultConversionEngine,
  filterCategoriesByTerm,
  formatConversionSummary,
  formatHistoryMeta,
  formatUnitLabel,
  formatUnitNumber,
  mapConversionError,
  resolveUnitSuggestion
} from '../../utils/unit-converter.utils';

@Component({
  selector: 'lib-unit-converter',
  standalone: true,
  templateUrl: './unit-converter.html',
  styleUrls: ['./unit-converter.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class UnitConverterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);

  private readonly engine = createDefaultConversionEngine();
  private readonly historyStore = new ConversionHistoryStore();
  private readonly presetStore = new PresetStore([...UNIT_CONVERTER_DEFAULT_PRESETS]);
  private readonly currencyService = createMockCurrencyRateService();
  private readonly defaultRateProvider = 'mockRates';

  readonly categories = CATEGORY_DEFINITIONS;
  readonly unitsByType = UNITS_BY_TYPE as Record<UnitType, UnitDefinition[]>;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = UNIT_CONVERTER_RELATED_TOOLS;
  readonly quickShortcuts = QUICK_SHORTCUTS;

  readonly searchTerm = signal('');
  readonly selectedCategory = signal<UnitType>(UNIT_CONVERTER_DEFAULT_CATEGORY);
  readonly conversionResult = signal<ConversionResult | null>(null);
  readonly conversionError = signal<string | null>(null);
  readonly isConverting = signal(false);
  readonly history = this.historyStore.all();
  readonly presets = this.presetStore.all();
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly conversionForm = this.fb.group({
    inputValue: this.fb.control(1, { nonNullable: true, validators: [Validators.required] }),
    inputUnit: this.fb.control('meter', { nonNullable: true }),
    outputUnit: this.fb.control('foot', { nonNullable: true })
  });

  readonly totalUnitCount = UNIT_DEFINITIONS.length;
  readonly totalCategoryCount = CATEGORY_DEFINITIONS.length;

  @ViewChild('inputField') readonly inputField?: ElementRef<HTMLInputElement>;
  @ViewChild('historySection') readonly historySection?: ElementRef<HTMLElement>;

  readonly categoryMeta = computed(() => {
    const categoryId = this.selectedCategory();
    const category = CATEGORY_DEFINITIONS.find((item) => item.id === categoryId) ?? null;
    const units = category ? (this.unitsByType[category.id] ?? []) : [];
    return { category, units };
  });

  readonly selectedCategoryDetails = computed(() => {
    const meta = this.categoryMeta();
    return {
      id: meta.category?.id ?? this.selectedCategory(),
      title: meta.category?.title ?? 'Converter',
      description: meta.category?.description ?? '',
      icon: meta.category?.icon ?? ''
    };
  });

  readonly selectedUnitsCount = computed(() => this.categoryMeta().units.length);

  readonly filteredCategories = computed(() =>
    filterCategoriesByTerm(CATEGORY_DEFINITIONS, this.searchTerm(), UNIT_INDEXES)
  );

  readonly quickPresetChips = computed(() => this.presets().slice(0, 4));
  readonly historyEntries = computed(() => this.history());
  readonly historyCount = computed(() => this.historyEntries().length);
  readonly presetCount = computed(() => this.presets().length);

  readonly formattedOutputValue = computed(() => {
    const result = this.conversionResult();
    if (!result) {
      return '';
    }
    return formatUnitNumber(result.outputValue, result.precision ?? 6);
  });

  readonly conversionSummary = computed(() => {
    const result = this.conversionResult();
    return result ? formatConversionSummary(result) : null;
  });

  readonly primarySuggestion = computed(() => {
    const result = this.conversionResult();
    const form = this.conversionForm.getRawValue();
    const suggestion = resolveUnitSuggestion({
      hasResult: result !== null,
      hasError: this.conversionError() !== null,
      category: this.selectedCategory(),
      inputUnitId: form.inputUnit,
      outputUnitId: form.outputUnit,
      inputValue: Number(form.inputValue ?? 0)
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  readonly liveRates$: Observable<Record<string, number>> = of({}).pipe(startWith({}));

  readonly trackCategory = (_: number, category: CategoryDefinition): UnitType => category.id;
  readonly trackUnit = (_: number, unit: UnitDefinition): string => unit.id;
  readonly trackPreset = (_: number, preset: ConversionPreset): string => preset.id;
  readonly trackHistory = (_: number, result: ConversionResult): string =>
    `${result.inputUnit.id}-${result.outputUnit.id}-${result.timestamp}`;
  readonly trackShortcut = (_: number, shortcut: QuickConversionShortcut): string => shortcut.id;

  constructor() {
    effect(() => {
      const category = this.selectedCategory();
      const categoryDefinition = CATEGORY_DEFINITIONS.find((item) => item.id === category);
      const primary = categoryDefinition?.primary ?? BASE_UNITS[category];
      const featuredUnits = categoryDefinition?.featuredUnits ?? [];
      const secondary = featuredUnits.length > 1 ? featuredUnits[1] : featuredUnits[0];

      this.conversionForm.patchValue(
        {
          inputUnit: primary,
          outputUnit: secondary ?? primary
        },
        { emitEvent: false }
      );
    });

    this.conversionForm.valueChanges
      .pipe(
        debounceTime(120),
        distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
        switchMap((value) => {
          const inputValue = Number(value.inputValue ?? 0);
          const inputUnit = value.inputUnit ?? BASE_UNITS[this.selectedCategory()];
          const outputUnit = value.outputUnit ?? BASE_UNITS[this.selectedCategory()];

          return this.performConversion(inputValue, inputUnit, outputUnit).pipe(
            catchError((error: unknown) => {
              this.conversionError.set(mapConversionError(error));
              return of(null);
            })
          );
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (result) => {
          if (!result) {
            return;
          }
          this.conversionResult.set(result);
          this.conversionError.set(null);
          this.historyStore.push(result);
        },
        error: (error: unknown) => {
          this.isConverting.set(false);
          this.conversionError.set(mapConversionError(error));
        }
      });
  }

  onCategorySearch(term: string): void {
    this.searchTerm.set(term.trim());
  }

  onConversionSubmit(): void {
    this.convertNow();
  }

  focusInputField(): void {
    this.inputField?.nativeElement.focus();
    this.toast.info('Enter a value to start converting.');
  }

  viewHistory(): void {
    this.historySection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.toast.info('Showing your recent conversions.');
  }

  manageHistory(): void {
    this.toast.info('History management tools are coming soon.');
  }

  customizeQuickActions(): void {
    this.toast.info('Quick conversion customization is on the roadmap.');
  }

  inviteCollaborators(): void {
    this.toast.info('Collaboration invites will be available in a future update.');
  }

  promptSavePreset(): void {
    const defaultName = `${this.selectedCategoryDetails().title} preset`;
    this.savePreset(defaultName);
    this.toast.info('Preset saved.');
  }

  onPresetChipClick(preset: ConversionPreset): void {
    this.applyPreset(preset);
    this.toast.info(`Preset "${preset.name}" applied.`);
  }

  applyQuickConversion(shortcut: QuickConversionShortcut): void {
    if (shortcut === undefined || shortcut === null) {
      return;
    }

    this.setCategory(shortcut.category, { notify: false });
    this.selectedCategory.set(shortcut.category);
    this.conversionForm.patchValue(
      {
        inputUnit: shortcut.inputUnit,
        outputUnit: shortcut.outputUnit
      },
      { emitEvent: true }
    );
    this.toast.info(`${shortcut.label} shortcut ready.`);
  }

  formatUnitLabel(unit: UnitDefinition): string {
    return formatUnitLabel(unit);
  }

  formatHistoryMeta(result: ConversionResult): string {
    return formatHistoryMeta(result);
  }

  formatNumber(value: number, precision = 6): string {
    return formatUnitNumber(value, precision);
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  setCategory(category: UnitType, options?: { notify?: boolean }): void {
    if (this.selectedCategory() === category) {
      return;
    }

    this.selectedCategory.set(category);
    const units = this.unitsByType[category] ?? [];
    const defaultInput = units.length > 0 ? units[0].id : BASE_UNITS[category];
    const defaultOutput = units.length > 1 ? units[1].id : defaultInput;

    this.conversionForm.patchValue(
      {
        inputUnit: defaultInput,
        outputUnit: defaultOutput
      },
      { emitEvent: true }
    );

    if (options?.notify ?? true) {
      const categoryDefinition = CATEGORY_DEFINITIONS.find((item) => item.id === category);
      if (categoryDefinition) {
        this.toast.info(`${categoryDefinition.title} converter ready.`);
      }
    }
  }

  swapUnits(): void {
    const { inputUnit, outputUnit } = this.conversionForm.value;
    if (!inputUnit || !outputUnit) {
      return;
    }

    this.conversionForm.patchValue(
      {
        inputUnit: outputUnit,
        outputUnit: inputUnit
      },
      { emitEvent: true }
    );
    this.toast.info('Units swapped.');
  }

  async copyResult(): Promise<void> {
    const summary = this.conversionSummary();
    if (!summary) {
      return;
    }
    await mdCopyText(this.toast, summary, 'Result');
  }

  convertNow(): void {
    const { inputValue, inputUnit, outputUnit } = this.conversionForm.value;

    this.performConversion(Number(inputValue ?? 0), inputUnit ?? '', outputUnit ?? '')
      .pipe(
        catchError((error: unknown) => {
          this.conversionError.set(mapConversionError(error));
          return of(null);
        })
      )
      .subscribe({
        next: (result) => {
          if (!result) {
            return;
          }
          this.conversionResult.set(result);
          this.conversionError.set(null);
          this.historyStore.push(result);
          this.toast.info('Conversion updated.');
        }
      });
  }

  savePreset(name: string): void {
    const { inputUnit, outputUnit } = this.conversionForm.value;
    const category = this.selectedCategory();

    this.presetStore.add({
      name,
      category,
      inputUnit: inputUnit ?? BASE_UNITS[category],
      outputUnit: outputUnit ?? BASE_UNITS[category]
    });
  }

  applyPreset(preset: ConversionPreset): void {
    this.selectedCategory.set(preset.category);
    this.conversionForm.patchValue(
      {
        inputUnit: preset.inputUnit,
        outputUnit: preset.outputUnit
      },
      { emitEvent: true }
    );
  }

  private performConversion(
    value: number,
    fromUnitId: string,
    toUnitId: string
  ): Observable<ConversionResult> {
    this.isConverting.set(true);
    this.conversionError.set(null);

    return defer(() => {
      if (!fromUnitId || !toUnitId) {
        throw new TypeError('Select units to convert.');
      }

      if (Number.isNaN(value)) {
        throw new TypeError('Enter a valid number.');
      }

      if (!Number.isFinite(value)) {
        throw new RangeError('Value is too large.');
      }

      const fromUnit = UNIT_INDEXES[fromUnitId];
      const toUnit = UNIT_INDEXES[toUnitId];

      if (!fromUnit || !toUnit) {
        throw new ReferenceError('Unknown unit.');
      }

      if (fromUnit.type === 'currency' && toUnit.type === 'currency') {
        return this.convertCurrency(value, fromUnit, toUnit);
      }

      return of(this.engine.convert(value, fromUnit.id, toUnit.id));
    }).pipe(
      tap({
        next: () => this.isConverting.set(false),
        error: (err: Error) => {
          this.isConverting.set(false);
          this.conversionError.set(err.message);
        }
      })
    );
  }

  private convertCurrency(
    value: number,
    fromUnit: UnitDefinition,
    toUnit: UnitDefinition
  ): Observable<ConversionResult> {
    return this.currencyService.getRates(this.defaultRateProvider).pipe(
      map((rates) => {
        const fromRate = rates[fromUnit.id];
        const toRate = rates[toUnit.id];

        if (!fromRate || !toRate) {
          throw new ReferenceError('Currency rate unavailable for the selected units.');
        }

        const factor = toRate / fromRate;
        const outputValue = value * factor;

        return {
          inputValue: value,
          inputUnit: fromUnit,
          outputValue,
          outputUnit: toUnit,
          timestamp: Date.now(),
          precision: 6,
          formula: `value × ${factor.toPrecision(6)}`
        };
      })
    );
  }
}
