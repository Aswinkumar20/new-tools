import { CommonModule } from '@angular/common';
import { Component, computed, EffectRef, inject, OnDestroy, signal, Signal, WritableSignal, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

@Component({
  selector: 'lib-age-calculator',
  standalone: true,
  templateUrl: './age-calculator.html',
  styleUrls: ['./age-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation]
})
export class AgeCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly calculationSubscription: Subscription;
  private readonly effectRefs: EffectRef[] = [];

  readonly anchors = ANCHORS;
  readonly presets = PRESETS;

  readonly form = this.fb.group({
    birthDate: this.fb.control<string>('1995-05-12', [Validators.required]),
    comparisonDate: this.fb.control<string>('today', [Validators.required]),
    anchor: this.fb.control<AnchorOption>('now', { nonNullable: true }),
    includeTime: this.fb.control(false, { nonNullable: true }),
    birthTime: this.fb.control('00:00'),
    comparisonTime: this.fb.control('00:00'),
    showTimeline: this.fb.control(true, { nonNullable: true }),
    includeZodiac: this.fb.control(true, { nonNullable: true }),
    includeMilestones: this.fb.control(true, { nonNullable: true })
  });

  readonly result: WritableSignal<AgeResult | null> = signal(null);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history: WritableSignal<AgeHistory[]> = signal([]);

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly timeline = computed(() => this.result()?.timeline ?? []);
  readonly milestones = computed(() => this.result()?.milestones ?? []);
  readonly zodiac = computed(() => this.result()?.zodiac ?? null);

  readonly timelineSegments = computed(() => {
    const result = this.result();
    const timeline = result?.timeline;
    const totalDays = result?.totalDays;

    if (!timeline || !totalDays) {
      return [];
    }

    return timeline.map((item) => ({
      ...item,
      proportion: Math.min(100, Math.max(0.5, (item.days / totalDays) * 100))
    }));
  });

  readonly activeAnchor = computed(() => this.form.get('anchor')?.value ?? 'now');

  constructor() {
    this.calculationSubscription = this.form.valueChanges
      .pipe(debounceTime(80), distinctUntilChanged())
      .subscribe(() => this.calculate());

    this.effectRefs.push(
      effect(() => {
        const includeTime = this.form.get('includeTime')?.value ?? false;
        if (!includeTime) {
          this.form.patchValue({ birthTime: '00:00', comparisonTime: '00:00' }, { emitEvent: false });
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

  setAnchor(anchor: AnchorOption): void {
    if (anchor === this.form.get('anchor')?.value) {
      return;
    }

    this.form.patchValue({ anchor, comparisonDate: anchor === 'now' ? 'today' : '' }, { emitEvent: true });
    this.notify(`Anchor changed to ${ANCHORS.find((item) => item.id === anchor)?.label ?? anchor}.`);
  }

  applyPreset(preset: AgePreset): void {
    this.form.patchValue(
      {
        birthDate: preset.birthDate,
        comparisonDate: preset.comparisonDate,
        anchor: preset.anchor ?? this.form.get('anchor')?.value ?? 'now',
        includeTime: preset.includeTime ?? this.form.get('includeTime')?.value ?? false,
        birthTime: preset.birthTime ?? '00:00',
        comparisonTime: preset.comparisonTime ?? '00:00'
      },
      { emitEvent: true }
    );
    this.notify(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.notify('Age recalculated.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.notify('History cleared.');
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
    this.notify('History entry restored.');
  }

  private calculate(): void {
    this.errorMessage.set(null);
    const rawBirthDate = this.form.get('birthDate')?.value ?? '';
    const rawComparisonDate = this.form.get('comparisonDate')?.value ?? 'today';
    const anchor = this.form.get('anchor')?.value ?? 'now';
    const includeTime = this.form.get('includeTime')?.value ?? false;
    const birthTime = this.form.get('birthTime')?.value ?? '00:00';
    const comparisonTime = this.form.get('comparisonTime')?.value ?? '00:00';
    const includeZodiac = this.form.get('includeZodiac')?.value ?? true;
    const includeMilestones = this.form.get('includeMilestones')?.value ?? true;
    const showTimeline = this.form.get('showTimeline')?.value ?? true;

    try {
      const calculator = new AgeCalculator();
      const comparisonDate = anchor === 'now' ? new Date() : parseDateString(rawComparisonDate, comparisonTime, includeTime);
      const birthDate = parseDateString(rawBirthDate, birthTime, includeTime);

      if (!birthDate || !comparisonDate) {
        throw new Error('Enter valid birth and comparison dates.');
      }

      const result = calculator.calculate({
        birthDate,
        comparisonDate,
        includeTime,
        includeZodiac,
        includeMilestones,
        showTimeline
      });

      this.result.set(result);
      this.pushHistory({
        ...result,
        birthDate: toISODate(birthDate),
        comparisonDate: anchor === 'now' ? 'today' : toISODate(comparisonDate),
        birthTime: includeTime ? birthTime : '00:00',
        comparisonTime: includeTime ? comparisonTime : '00:00',
        anchor,
        includeTime,
        includeZodiac,
        includeMilestones,
        showTimeline
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to calculate age.';
      this.errorMessage.set(message);
      this.result.set(null);
    }
  }

  private pushHistory(entry: AgeHistory): void {
    this.history.update((current) => {
      const filtered = current.filter(
        (item) => !(item.birthDate === entry.birthDate && item.comparisonDate === entry.comparisonDate && item.anchor === entry.anchor)
      );
      return [{ ...entry }, ...filtered].slice(0, 9);
    });
  }

  private notify(message: string): void {
    this.statusMessage.set(message);
    setTimeout(() => this.statusMessage.set(null), 3200);
  }

  readonly trackAnchor = (_: number, anchor: AnchorDefinition) => anchor.id;
  readonly trackPreset = (_: number, preset: AgePreset) => preset.label;
  readonly trackTimeline = (_: number, item: TimelineItem) => item.label;
  readonly trackMilestone = (_: number, item: MilestoneItem) => item.label;
  readonly trackHistory = (_: number, item: AgeHistory) => `${item.birthDate}-${item.comparisonDate}-${item.anchor}`;

  getPresetLabel(anchor: AnchorOption): string {
    return ANCHORS.find((item) => item.id === anchor)?.label ?? anchor;
  }
}

type AnchorOption = 'now' | 'specific';

interface AnchorDefinition {
  id: AnchorOption;
  label: string;
  description: string;
}

interface AgeCalculatorOptions {
  birthDate: Date;
  comparisonDate: Date;
  includeTime: boolean;
  includeZodiac: boolean;
  includeMilestones: boolean;
  showTimeline: boolean;
}

interface AgeResult {
  summary: AgeSummary;
  totalDays: number;
  timeline?: TimelineItem[];
  milestones?: MilestoneItem[];
  zodiac?: ZodiacInfo;
}

interface AgeSummary {
  years: number;
  months: number;
  days: number;
  hours?: number;
  minutes?: number;
  nextBirthday: string;
  nextBirthdayCountdown: CountdownBreakdown;
  exactAge: string;
  ageInUnits: AgeUnits;
}

interface AgeUnits {
  weeks: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

interface CountdownBreakdown {
  months: number;
  days: number;
  hours: number;
}

interface TimelineItem {
  label: string;
  description: string;
  days: number;
}

interface MilestoneItem {
  label: string;
  description: string;
  targetDate: string;
  remaining: CountdownBreakdown;
}

interface ZodiacInfo {
  western: string;
  chinese: string;
}

interface AgeHistory extends AgeResult {
  birthDate: string;
  comparisonDate: string;
  birthTime: string;
  comparisonTime: string;
  anchor: AnchorOption;
  includeTime: boolean;
  includeZodiac: boolean;
  includeMilestones: boolean;
  showTimeline: boolean;
}

interface AgePreset {
  label: string;
  birthDate: string;
  comparisonDate: string;
  anchor?: AnchorOption;
  includeTime?: boolean;
  birthTime?: string;
  comparisonTime?: string;
}

const ANCHORS: AnchorDefinition[] = [
  {
    id: 'now',
    label: 'Compare to today',
    description: 'Keeps comparison date in sync with the current moment.'
  },
  {
    id: 'specific',
    label: 'Compare to specific date',
    description: 'Choose a fixed comparison date for planning or retrospectives.'
  }
];

const PRESETS: AgePreset[] = [
  { label: 'Millennial 30th birthday', birthDate: '1994-08-15', comparisonDate: '2024-08-15', anchor: 'specific' },
  { label: 'Gen Alpha (12 y)', birthDate: '2012-03-20', comparisonDate: 'today', anchor: 'now' },
  { label: 'Retirement planning', birthDate: '1975-11-02', comparisonDate: '2035-01-01', anchor: 'specific' },
  { label: 'Newborn', birthDate: '2024-01-10', comparisonDate: 'today', anchor: 'now', includeTime: true, birthTime: '05:45' }
];

class AgeCalculator {
  calculate(options: AgeCalculatorOptions): AgeResult {
    const { birthDate, comparisonDate, includeTime, includeMilestones, includeZodiac, showTimeline } = options;

    if (comparisonDate.getTime() < birthDate.getTime()) {
      throw new Error('Comparison date cannot be earlier than the birth date.');
    }

    const diffMilliseconds = comparisonDate.getTime() - birthDate.getTime();
    const totalDays = Math.floor(diffMilliseconds / MS_IN_DAY);
    const totalHours = Math.floor(diffMilliseconds / (1000 * 60 * 60));
    const totalMinutes = Math.floor(diffMilliseconds / (1000 * 60));
    const totalSeconds = Math.floor(diffMilliseconds / 1000);

    const { years, months, days } = computeYMD(birthDate, comparisonDate);
    const summary: AgeSummary = {
      years,
      months,
      days,
      nextBirthday: formatDate(computeNextBirthday(birthDate, comparisonDate)),
      nextBirthdayCountdown: computeCountdown(comparisonDate, computeNextBirthday(birthDate, comparisonDate)),
      exactAge: formatExactAge({ years, months, days }),
      ageInUnits: {
        weeks: Math.floor(totalDays / 7),
        days: totalDays,
        hours: totalHours,
        minutes: totalMinutes,
        seconds: totalSeconds
      }
    };

    if (includeTime) {
      summary.hours = totalHours % 24;
      summary.minutes = totalMinutes % 60;
    }

    const timeline = showTimeline ? buildTimeline(summary.ageInUnits, years) : undefined;
    const milestones = includeMilestones ? buildMilestones(birthDate, comparisonDate) : undefined;
    const zodiac = includeZodiac ? buildZodiac(birthDate) : undefined;

    return { summary, timeline, milestones, zodiac, totalDays };
  }
}

function parseDateString(raw: string, time: string, includeTime: boolean): Date {
  if (!raw.trim()) {
    throw new Error('Date cannot be empty.');
  }

  if (raw === 'today') {
    return new Date();
  }

  const [hours, minutes] = includeTime ? parseTime(time) : [0, 0];
  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date format. Use YYYY-MM-DD.');
  }

  date.setHours(hours, minutes, 0, 0);
  return date;
}

function parseTime(value: string): [number, number] {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) {
    return [0, 0];
  }

  const [hours, minutes] = value.split(':').map((part) => Number(part));
  return [Number.isFinite(hours) ? hours : 0, Number.isFinite(minutes) ? minutes : 0];
}

function computeYMD(start: Date, end: Date): { years: number; months: number; days: number } {
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

  return { years, months, days };
}

function computeNextBirthday(birthDate: Date, referenceDate: Date): Date {
  const next = new Date(referenceDate.getFullYear(), birthDate.getMonth(), birthDate.getDate());
  if (next < referenceDate) {
    next.setFullYear(next.getFullYear() + 1);
  }
  return next;
}

function computeCountdown(from: Date, to: Date): CountdownBreakdown {
  const diff = to.getTime() - from.getTime();
  const totalDays = Math.floor(diff / MS_IN_DAY);
  const months = Math.floor(totalDays / 30);
  const days = totalDays % 30;
  const hours = Math.floor((diff % MS_IN_DAY) / (1000 * 60 * 60));
  return { months, days, hours };
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function formatExactAge(parts: { years: number; months: number; days: number }): string {
  const segments: string[] = [];
  if (parts.years > 0) {
    segments.push(`${parts.years} year${parts.years === 1 ? '' : 's'}`);
  }
  if (parts.months > 0) {
    segments.push(`${parts.months} month${parts.months === 1 ? '' : 's'}`);
  }
  if (parts.days > 0) {
    segments.push(`${parts.days} day${parts.days === 1 ? '' : 's'}`);
  }
  return segments.length ? segments.join(', ') : '0 days';
}

function buildTimeline(units: AgeUnits, years: number): TimelineItem[] {
  return [
    {
      label: 'Years lived',
      description: `Full years since birth (${years})`,
      days: years * 365
    },
    {
      label: 'Weeks lived',
      description: 'Total weeks experienced',
      days: Math.round(units.weeks * 7)
    },
    {
      label: 'Days lived',
      description: 'Exact total days',
      days: units.days
    }
  ];
}

function buildMilestones(birthDate: Date, reference: Date): MilestoneItem[] {
  const futureMilestones = [
    { label: '10,000 days', offsetDays: 10000 },
    { label: '20,000 days', offsetDays: 20000 },
    { label: '100th birthday', offsetDays: 36525 }
  ];

  return futureMilestones
    .map((milestone) => {
      const target = new Date(birthDate.getTime() + milestone.offsetDays * MS_IN_DAY);
      if (target <= reference) {
        return null;
      }

      return {
        label: milestone.label,
        description: `Happens on ${formatDate(target)}`,
        targetDate: formatDate(target),
        remaining: computeCountdown(reference, target)
      };
    })
    .filter((item): item is MilestoneItem => item !== null);
}

function buildZodiac(birthDate: Date): ZodiacInfo {
  return {
    western: determineWesternZodiac(birthDate),
    chinese: determineChineseZodiac(birthDate)
  };
}

function determineWesternZodiac(date: Date): string {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();

  const signs = [
    { sign: 'Capricorn', start: [12, 22] },
    { sign: 'Aquarius', start: [1, 20] },
    { sign: 'Pisces', start: [2, 19] },
    { sign: 'Aries', start: [3, 21] },
    { sign: 'Taurus', start: [4, 20] },
    { sign: 'Gemini', start: [5, 21] },
    { sign: 'Cancer', start: [6, 21] },
    { sign: 'Leo', start: [7, 23] },
    { sign: 'Virgo', start: [8, 23] },
    { sign: 'Libra', start: [9, 23] },
    { sign: 'Scorpio', start: [10, 23] },
    { sign: 'Sagittarius', start: [11, 22] },
    { sign: 'Capricorn', start: [12, 31] }
  ];

  for (let i = 1; i < signs.length; i++) {
    const [startMonth, startDay] = signs[i].start;
    if (month < startMonth || (month === startMonth && day < startDay)) {
      return signs[i - 1].sign;
    }
  }

  return 'Capricorn';
}

function determineChineseZodiac(date: Date): string {
  const animals = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig'];
  const year = date.getFullYear();
  return animals[(year - 4) % 12];
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

const MS_IN_DAY = 1000 * 60 * 60 * 24;
