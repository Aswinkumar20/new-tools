import { CommonModule } from '@angular/common';
import { Component, computed, EffectRef, inject, OnDestroy, signal, Signal, WritableSignal, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation, TooltipDirective, AssetService } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

@Component({
  selector: 'lib-date-difference-calculator',
  standalone: true,
  templateUrl: './date-difference-calculator.html',
  styleUrls: ['./date-difference-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation, TooltipDirective]
})
export class DateDifferenceCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  readonly assetService = inject(AssetService);
  private readonly calculationSubscription: Subscription;
  private readonly effectRefs: EffectRef[] = [];

  readonly presets = PRESETS;

  readonly form = this.fb.group({
    startDate: this.fb.control<string>('2023-01-01', [Validators.required]),
    endDate: this.fb.control<string>('today', [Validators.required]),
    includeTime: this.fb.control<boolean>(false, { nonNullable: true }),
    startTime: this.fb.control('08:30'),
    endTime: this.fb.control('17:15'),
    countBusinessDays: this.fb.control<boolean>(true, { nonNullable: true }),
    includeTimeline: this.fb.control<boolean>(true, { nonNullable: true }),
    includeMilestones: this.fb.control<boolean>(true, { nonNullable: true }),
    includeWeekdayBreakdown: this.fb.control<boolean>(true, { nonNullable: true })
  });

  readonly result: WritableSignal<DateDiffResult | null> = signal(null);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history: WritableSignal<DateDiffHistory[]> = signal([]);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly timeline = computed(() => this.result()?.timeline ?? []);
  readonly milestones = computed(() => this.result()?.milestones ?? []);
  readonly weekdayBreakdown = computed(() => this.result()?.weekdayBreakdown ?? null);

  readonly durationSegments = computed(() => {
    const current = this.result();
    const totalDays = current?.summary.totalDays ?? 0;
    const segments = current?.timeline ?? [];
    if (!totalDays || segments.length === 0) {
      return [];
    }
    return segments.map((segment) => ({
      ...segment,
      proportion: Math.min(100, Math.max(0.5, (segment.days / totalDays) * 100))
    }));
  });

  constructor() {
    this.calculationSubscription = this.form.valueChanges
      .pipe(debounceTime(100), distinctUntilChanged())
      .subscribe(() => this.calculate());

    this.effectRefs.push(
      effect(() => {
        const includeTime = this.form.get('includeTime')?.value ?? false;
        if (!includeTime) {
          this.form.patchValue({ startTime: '00:00', endTime: '00:00' }, { emitEvent: false });
        }
      })
    );

    this.calculate();
  }

  ngOnDestroy(): void {
    this.calculationSubscription.unsubscribe();
    for (const ref of this.effectRefs) {
      ref.destroy();
    }
  }

  applyPreset(preset: DateDiffPreset): void {
    this.form.patchValue(
      {
        startDate: preset.startDate,
        endDate: preset.endDate,
        includeTime: preset.includeTime ?? this.form.get('includeTime')?.value ?? false,
        startTime: preset.startTime ?? this.form.get('startTime')?.value ?? '00:00',
        endTime: preset.endTime ?? this.form.get('endTime')?.value ?? '00:00',
        countBusinessDays: preset.countBusinessDays ?? this.form.get('countBusinessDays')?.value ?? true,
        includeMilestones: preset.includeMilestones ?? this.form.get('includeMilestones')?.value ?? true
      },
      { emitEvent: true }
    );
    this.notify(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.notify('Difference recalculated.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.notify('History cleared.');
  }

  copyResult(): void {
    const s = this.summary();
    if (!s) return;
    const text = [
      `${s.startDateLabel} → ${s.endDateLabel}`,
      `Span: ${s.exactSpan}`,
      `Total days: ${s.totalDays}`,
      s.businessDays !== undefined ? `Business days: ${s.businessDays}` : '',
    ].filter(Boolean).join('\n');
    navigator.clipboard.writeText(text).then(() => this.notify('Result copied to clipboard.'));
  }

  restoreHistory(entry: DateDiffHistory): void {
    this.form.patchValue(
      {
        startDate: entry.startDate,
        endDate: entry.endDate,
        includeTime: entry.includeTime,
        startTime: entry.startTime,
        endTime: entry.endTime,
        countBusinessDays: entry.countBusinessDays,
        includeTimeline: entry.includeTimeline,
        includeMilestones: entry.includeMilestones,
        includeWeekdayBreakdown: entry.includeWeekdayBreakdown
      },
      { emitEvent: true }
    );
    this.notify('History entry restored.');
  }

  private calculate(): void {
    this.errorMessage.set(null);
    const rawStart = this.form.get('startDate')?.value ?? '';
    const rawEnd = (this.form.get('endDate')?.value ?? '').trim() || 'today';
    const includeTime = this.form.get('includeTime')?.value ?? false;
    const startTime = this.form.get('startTime')?.value ?? '00:00';
    const endTime = this.form.get('endTime')?.value ?? '00:00';
    const includeTimeline = this.form.get('includeTimeline')?.value ?? true;
    const includeMilestones = this.form.get('includeMilestones')?.value ?? true;
    const countBusinessDays = this.form.get('countBusinessDays')?.value ?? true;
    const includeWeekdayBreakdown = this.form.get('includeWeekdayBreakdown')?.value ?? true;

    try {
      const startDate = parseDateInput(rawStart, startTime, includeTime, 'Start date');
      const endDate = rawEnd === 'today' ? new Date() : parseDateInput(rawEnd, endTime, includeTime, 'End date');

      const calculator = new DateDifferenceCalculator();
      const result = calculator.calculate({
        startDate,
        endDate,
        includeTime,
        includeTimeline,
        includeMilestones,
        countBusinessDays,
        includeWeekdayBreakdown
      });

      this.result.set(result);
      this.pushHistory({
        ...result,
        startDate: toISODate(startDate),
        endDate: rawEnd.trim() === 'today' ? 'today' : toISODate(endDate),
        startTime: includeTime ? startTime : '00:00',
        endTime: includeTime ? endTime : '00:00',
        includeTime,
        includeTimeline,
        includeMilestones,
        countBusinessDays,
        includeWeekdayBreakdown
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to compute date difference.';
      this.errorMessage.set(message);
      this.result.set(null);
    }
  }

  private pushHistory(entry: DateDiffHistory): void {
    this.history.update((current) => {
      const filtered = current.filter(
        (item) => !(item.startDate === entry.startDate && item.endDate === entry.endDate && item.includeTime === entry.includeTime)
      );
      return [{ ...entry }, ...filtered].slice(0, 9);
    });
  }

  private notify(message: string): void {
    this.statusMessage.set(message);
    setTimeout(() => this.statusMessage.set(null), 3000);
  }

  readonly trackPreset = (_: number, preset: DateDiffPreset) => preset.label;
  readonly trackTimeline = (_: number, segment: TimelineSegment) => segment.label;
  readonly trackMilestone = (_: number, milestone: Milestone) => milestone.label;
  readonly trackHistory = (_: number, entry: DateDiffHistory) => `${entry.startDate}-${entry.endDate}-${entry.includeTime}`;

  formatCountdown(value: Countdown | undefined): string {
    if (!value) {
      return '';
    }
    return `${value.months} month${value.months === 1 ? '' : 's'} · ${value.days} day${value.days === 1 ? '' : 's'} · ${value.hours} hour${value.hours === 1 ? '' : 's'}`;
  }

  formatNumber(value: number): string {
    return value.toLocaleString();
  }
}

type DateDiffPreset = {
  label: string;
  startDate: string;
  endDate: string;
  includeTime?: boolean;
  startTime?: string;
  endTime?: string;
  countBusinessDays?: boolean;
  includeMilestones?: boolean;
};

type TimelineSegment = {
  label: string;
  description: string;
  days: number;
};

type Milestone = {
  label: string;
  description: string;
  targetDate: string;
  remaining: Countdown;
};

type Countdown = {
  months: number;
  days: number;
  hours: number;
};

type DateDiffResult = {
  summary: DateDiffSummary;
  timeline?: TimelineSegment[];
  milestones?: Milestone[];
  weekdayBreakdown?: WeekdayBreakdown;
};

type WeekdayBreakdown = {
  weekdays: number;
  weekendDays: number;
  businessDays?: number;
};

type DateDiffSummary = {
  isForward: boolean;
  startDateLabel: string;
  endDateLabel: string;
  exactSpan: string;
  totalYears: number;
  totalMonths: number;
  totalDays: number;
  totalHours: number;
  totalMinutes: number;
  totalSeconds: number;
  businessDays?: number;
};

type DateDiffHistory = DateDiffResult & {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  includeTime: boolean;
  includeTimeline: boolean;
  includeMilestones: boolean;
  countBusinessDays: boolean;
  includeWeekdayBreakdown: boolean;
};

const PRESETS: DateDiffPreset[] = [
  { label: 'Project quarter', startDate: '2024-01-01', endDate: '2024-03-31', countBusinessDays: true },
  { label: 'Fiscal half year', startDate: '2023-04-01', endDate: '2023-09-30', countBusinessDays: true, includeMilestones: true },
  { label: 'Conference countdown', startDate: 'today', endDate: '2024-11-05', includeTime: true, startTime: '09:00', endTime: '08:30' },
  { label: 'Warranty check', startDate: '2022-07-15', endDate: 'today', countBusinessDays: false },
  { label: '100 day planning', startDate: 'today', endDate: '2024-09-15', includeMilestones: true }
];

class DateDifferenceCalculator {
  calculate(options: {
    startDate: Date;
    endDate: Date;
    includeTime: boolean;
    includeTimeline: boolean;
    includeMilestones: boolean;
    countBusinessDays: boolean;
    includeWeekdayBreakdown: boolean;
  }): DateDiffResult {
    const { startDate, endDate, includeTime, includeTimeline, includeMilestones, countBusinessDays, includeWeekdayBreakdown } = options;

    const direction = endDate.getTime() >= startDate.getTime();
    const earlier = direction ? startDate : endDate;
    const later = direction ? endDate : startDate;

    const diffMs = later.getTime() - earlier.getTime();
    const totalSeconds = Math.floor(diffMs / 1000);
    const totalMinutes = Math.floor(diffMs / (1000 * 60));
    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const totalDays = Math.floor(diffMs / MS_IN_DAY);

    const diffParts = computeDifferenceParts(earlier, later);
    const businessDays = countBusinessDays ? computeBusinessDays(earlier, later) : undefined;
    const weekdayBreakdown = includeWeekdayBreakdown ? computeWeekdayBreakdown(earlier, later) : undefined;

    const summary: DateDiffSummary = {
      isForward: direction,
      startDateLabel: formatDate(earlier),
      endDateLabel: formatDate(later),
      exactSpan: formatExactSpan(diffParts),
      totalYears: diffParts.years,
      totalMonths: diffParts.months,
      totalDays,
      totalHours,
      totalMinutes,
      totalSeconds,
      businessDays
    };

    const timeline = includeTimeline ? buildTimeline(diffParts, totalDays) : undefined;
    const milestones = includeMilestones ? buildMilestones(later) : undefined;

    if (includeTime) {
      summary.totalHours = diffParts.hours ?? summary.totalHours;
      summary.totalMinutes = diffParts.minutes ?? summary.totalMinutes;
    }

    return {
      summary,
      timeline,
      milestones,
      weekdayBreakdown
    };
  }
}

function parseDateInput(raw: string, time: string, includeTime: boolean, label: string): Date {
  if (!raw.trim()) {
    throw new Error(`${label} cannot be empty.`);
  }

  const baseDate = raw.trim() === 'today' ? new Date() : new Date(raw);
  if (Number.isNaN(baseDate.getTime())) {
    throw new Error(`${label} is not a valid date. Use YYYY-MM-DD.`);
  }

  if (includeTime && time && /^\d{2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(':').map((value) => Number(value));
    baseDate.setHours(hours, minutes, 0, 0);
  } else {
    baseDate.setHours(0, 0, 0, 0);
  }

  return baseDate;
}

function computeDifferenceParts(start: Date, end: Date): { years: number; months: number; days: number; hours?: number; minutes?: number } {
  let years = end.getFullYear() - start.getFullYear();
  let months = end.getMonth() - start.getMonth();
  let days = end.getDate() - start.getDate();

  if (days < 0) {
    const temp = new Date(end.getFullYear(), end.getMonth(), 0);
    days += temp.getDate();
    months -= 1;
  }

  if (months < 0) {
    months += 12;
    years -= 1;
  }

  const hours = end.getHours() - start.getHours();
  const minutes = end.getMinutes() - start.getMinutes();

  return { years, months, days, hours, minutes };
}

function formatExactSpan(parts: { years: number; months: number; days: number }): string {
  const segments: string[] = [];
  if (parts.years) {
    segments.push(`${parts.years} year${parts.years === 1 ? '' : 's'}`);
  }
  if (parts.months) {
    segments.push(`${parts.months} month${parts.months === 1 ? '' : 's'}`);
  }
  if (parts.days || segments.length === 0) {
    segments.push(`${parts.days} day${parts.days === 1 ? '' : 's'}`);
  }
  return segments.join(', ');
}

function computeBusinessDays(start: Date, end: Date): number {
  let businessDays = 0;
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      businessDays += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return businessDays;
}

function computeWeekdayBreakdown(start: Date, end: Date): WeekdayBreakdown {
  let weekdays = 0;
  let weekendDays = 0;
  const cursor = new Date(start.getTime());
  while (cursor <= end) {
    const day = cursor.getDay();
    if (day === 0 || day === 6) {
      weekendDays += 1;
    } else {
      weekdays += 1;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { weekdays, weekendDays, businessDays: weekdays };
}

function buildTimeline(diff: { years: number; months: number; days: number }, totalDays: number): TimelineSegment[] {
  return [
    {
      label: 'Years',
      description: `${diff.years} full years in span`,
      days: diff.years * 365
    },
    {
      label: 'Months',
      description: `${diff.months} additional month${diff.months === 1 ? '' : 's'}`,
      days: diff.months * 30
    },
    {
      label: 'Remaining days',
      description: `Beyond complete months`,
      days: diff.days
    },
    {
      label: 'Total span',
      description: `Exact days in this interval`,
      days: totalDays
    }
  ];
}

function buildMilestones(endDate: Date): Milestone[] {
  const futureTargets = [30, 90, 180, 365, 730];
  const now = new Date();
  return futureTargets
    .map((days) => {
      const target = new Date(now.getTime() + days * MS_IN_DAY);
      if (target > endDate) {
        return null;
      }
      return {
        label: `${days}-day mark from today`,
        description: `Occurs on ${formatDate(target)}`,
        targetDate: formatDate(target),
        remaining: computeCountdown(now, target)
      };
    })
    .filter((item): item is Milestone => item !== null);
}

function computeCountdown(from: Date, to: Date): Countdown {
  const diff = to.getTime() - from.getTime();
  const totalDays = Math.floor(diff / MS_IN_DAY);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const hours = Math.floor((diff % MS_IN_DAY) / (1000 * 60 * 60));
  return { months, days, hours };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const MS_IN_DAY = 1000 * 60 * 60 * 24;
