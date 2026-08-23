import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  computed,
  inject,
  signal
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AssetService, Navigation, ToastService, TooltipDirective } from '@tools-workspace/features-home';
import { Subscription, debounceTime } from 'rxjs';
import {
  AGE_ANCHORS,
  AGE_DEFAULT_FORM,
  AGE_HISTORY_LIMIT,
  AGE_PRESETS,
  AGE_RELATED_TOOLS
} from '../../constants/age-calculator.constants';
import { mdCopyText } from '../../shared/md-clipboard.util';
import type { MdRelatedToolLink } from '../../shared/md-tool-suggestion.model';
import type {
  AgeCalculatorFormGroup,
  AgeCalculatorFormValues,
  AgeHistory,
  AgePreset,
  AgeResult,
  AnchorDefinition,
  AnchorOption,
  MilestoneItem,
  TimelineSegment
} from '../../types/age-calculator.types';
import {
  buildTimelineSegments,
  calculateAge,
  formatAgeResultText,
  mapAgeCalculationError,
  parseDateString,
  prependAgeHistory,
  resolveAgeSuggestion,
  toISODate
} from '../../utils/age-calculator.utils';

@Component({
  selector: 'lib-age-calculator',
  standalone: true,
  templateUrl: './age-calculator.html',
  styleUrls: ['./age-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, RouterLink, Navigation, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgeCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly assetService = inject(AssetService);
  private readonly subscriptions = new Subscription();

  readonly anchors = AGE_ANCHORS;
  readonly presets = AGE_PRESETS;
  readonly relatedTools: ReadonlyArray<MdRelatedToolLink> = AGE_RELATED_TOOLS;

  readonly form: AgeCalculatorFormGroup = this.fb.group({
    birthDate: this.fb.control<string>(AGE_DEFAULT_FORM.birthDate, [Validators.required]),
    comparisonDate: this.fb.control<string>(AGE_DEFAULT_FORM.comparisonDate, [Validators.required]),
    anchor: this.fb.control<AnchorOption>(AGE_DEFAULT_FORM.anchor, { nonNullable: true }),
    includeTime: this.fb.control(AGE_DEFAULT_FORM.includeTime, { nonNullable: true }),
    birthTime: this.fb.control(AGE_DEFAULT_FORM.birthTime),
    comparisonTime: this.fb.control(AGE_DEFAULT_FORM.comparisonTime),
    showTimeline: this.fb.control(AGE_DEFAULT_FORM.showTimeline, { nonNullable: true }),
    includeZodiac: this.fb.control(AGE_DEFAULT_FORM.includeZodiac, { nonNullable: true }),
    includeMilestones: this.fb.control(AGE_DEFAULT_FORM.includeMilestones, { nonNullable: true })
  });

  readonly result = signal<AgeResult | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history = signal<AgeHistory[]>([]);
  readonly formSnapshot = signal<AgeCalculatorFormValues>(this.readFormValues());
  private readonly dismissedSuggestionId = signal<string | null>(null);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly milestones = computed(() => this.result()?.milestones ?? []);
  readonly zodiac = computed(() => this.result()?.zodiac ?? null);

  readonly timelineSegments = computed(() => {
    const current = this.result();
    return buildTimelineSegments(current?.timeline, current?.totalDays);
  });

  readonly activeAnchor = computed(() => this.formSnapshot().anchor);

  readonly primarySuggestion = computed(() => {
    const current = this.result();
    const snapshot = this.formSnapshot();
    const suggestion = resolveAgeSuggestion({
      hasResult: current !== null,
      hasError: this.errorMessage() !== null,
      anchor: snapshot.anchor,
      includeZodiac: snapshot.includeZodiac,
      totalDays: current?.totalDays ?? 0,
      years: current?.summary.years ?? 0
    });

    if (!suggestion || this.dismissedSuggestionId() === suggestion.id) {
      return null;
    }
    return suggestion;
  });

  constructor() {
    this.subscriptions.add(
      this.form.valueChanges.subscribe(() => {
        if (!this.form.controls.includeTime.value) {
          this.form.patchValue(
            { birthTime: '00:00', comparisonTime: '00:00' },
            { emitEvent: false }
          );
        }
        this.formSnapshot.set(this.readFormValues());
      })
    );

    this.subscriptions.add(
      this.form.valueChanges.pipe(debounceTime(80)).subscribe(() => {
        this.recalculateAge();
      })
    );

    this.recalculateAge();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  setAnchor(anchor: AnchorOption): void {
    if (anchor === this.form.controls.anchor.value) {
      return;
    }

    this.form.patchValue(
      { anchor, comparisonDate: anchor === 'now' ? 'today' : '' },
      { emitEvent: true }
    );
    this.toast.info(
      `Anchor changed to ${AGE_ANCHORS.find((item) => item.id === anchor)?.label ?? anchor}.`
    );
  }

  applyPreset(preset: AgePreset): void {
    this.form.patchValue(
      {
        birthDate: preset.birthDate,
        comparisonDate: preset.comparisonDate,
        anchor: preset.anchor ?? this.form.controls.anchor.value,
        includeTime: preset.includeTime ?? this.form.controls.includeTime.value,
        birthTime: preset.birthTime ?? '00:00',
        comparisonTime: preset.comparisonTime ?? '00:00'
      },
      { emitEvent: true }
    );
    this.toast.info(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.recalculateAge();
    this.toast.info('Age recalculated.');
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
    await mdCopyText(this.toast, formatAgeResultText(current), 'Result');
  }

  resetToDefault(): void {
    this.form.patchValue({ ...AGE_DEFAULT_FORM }, { emitEvent: true });
    this.toast.info('Reset to default values.');
  }

  restoreHistory(entry: AgeHistory): void {
    this.form.patchValue(
      {
        birthDate: entry.birthDate,
        comparisonDate: entry.comparisonDate,
        anchor: entry.anchor,
        includeTime: entry.includeTime,
        birthTime: entry.birthTime,
        comparisonTime: entry.comparisonTime,
        showTimeline: entry.showTimeline,
        includeZodiac: entry.includeZodiac,
        includeMilestones: entry.includeMilestones
      },
      { emitEvent: true }
    );
    this.toast.info('History entry restored.');
  }

  dismissSuggestion(suggestionId: string): void {
    this.dismissedSuggestionId.set(suggestionId);
  }

  getPresetLabel(anchor: AnchorOption): string {
    return AGE_ANCHORS.find((item) => item.id === anchor)?.label ?? anchor;
  }

  readonly trackAnchor = (_: number, anchor: AnchorDefinition) => anchor.id;
  readonly trackPreset = (_: number, preset: AgePreset) => preset.label;
  readonly trackTimeline = (_: number, item: TimelineSegment) => item.label;
  readonly trackMilestone = (_: number, item: MilestoneItem) => item.label;
  readonly trackHistory = (_: number, item: AgeHistory) =>
    `${item.birthDate}-${item.comparisonDate}-${item.anchor}`;

  private readFormValues(): AgeCalculatorFormValues {
    const raw = this.form.getRawValue();
    return {
      birthDate: raw.birthDate ?? AGE_DEFAULT_FORM.birthDate,
      comparisonDate: raw.comparisonDate ?? AGE_DEFAULT_FORM.comparisonDate,
      anchor: raw.anchor,
      includeTime: raw.includeTime,
      birthTime: raw.birthTime ?? AGE_DEFAULT_FORM.birthTime,
      comparisonTime: raw.comparisonTime ?? AGE_DEFAULT_FORM.comparisonTime,
      showTimeline: raw.showTimeline,
      includeZodiac: raw.includeZodiac,
      includeMilestones: raw.includeMilestones
    };
  }

  private recalculateAge(): void {
    this.errorMessage.set(null);
    const snapshot = this.readFormValues();

    try {
      const comparisonDate =
        snapshot.anchor === 'now'
          ? new Date()
          : parseDateString(snapshot.comparisonDate, snapshot.comparisonTime, snapshot.includeTime);
      const birthDate = parseDateString(
        snapshot.birthDate,
        snapshot.birthTime,
        snapshot.includeTime
      );

      if (!birthDate || !comparisonDate) {
        throw new Error('Enter valid birth and comparison dates.');
      }

      const nextResult = calculateAge({
        birthDate,
        comparisonDate,
        includeTime: snapshot.includeTime,
        includeZodiac: snapshot.includeZodiac,
        includeMilestones: snapshot.includeMilestones,
        showTimeline: snapshot.showTimeline
      });

      this.result.set(nextResult);
      this.history.update((current) =>
        prependAgeHistory(
          current,
          {
            ...nextResult,
            birthDate: toISODate(birthDate),
            comparisonDate: snapshot.anchor === 'now' ? 'today' : toISODate(comparisonDate),
            birthTime: snapshot.includeTime ? snapshot.birthTime : '00:00',
            comparisonTime: snapshot.includeTime ? snapshot.comparisonTime : '00:00',
            anchor: snapshot.anchor,
            includeTime: snapshot.includeTime,
            includeZodiac: snapshot.includeZodiac,
            includeMilestones: snapshot.includeMilestones,
            showTimeline: snapshot.showTimeline
          },
          AGE_HISTORY_LIMIT
        )
      );
    } catch (error) {
      this.errorMessage.set(mapAgeCalculationError(error));
      this.result.set(null);
    }
  }
}
