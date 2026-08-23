import { CommonModule } from '@angular/common';
import { Component, computed, EffectRef, inject, OnDestroy, signal, WritableSignal, effect } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Navigation } from '@tools-workspace/features-home';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';

@Component({
  selector: 'lib-bmi-calculator',
  standalone: true,
  templateUrl: './bmi-calculator.html',
  styleUrls: ['./bmi-calculator.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation]
})
export class BmiCalculatorComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly calculationSub: Subscription;
  private readonly effectRefs: EffectRef[] = [];

  readonly units = UNIT_OPTIONS;
  readonly presets = BMI_PRESETS;

  readonly form = this.fb.group({
    unit: this.fb.control<UnitSystem>('metric', { nonNullable: true }),
    weight: this.fb.control('70', [Validators.required, numberValidator]),
    height: this.fb.control('175', [Validators.required, numberValidator]),
    age: this.fb.control('28', [numberValidator]),
    gender: this.fb.control<Gender>('unspecified', { nonNullable: true }),
    waist: this.fb.control('', [numberValidator]),
    includeHistory: this.fb.control(true, { nonNullable: true })
  });

  readonly result: WritableSignal<BmiResult | null> = signal(null);
  readonly statusMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly history: WritableSignal<BmiHistory[]> = signal([]);

  readonly activeUnit = computed(() => this.units.find((option) => option.id === (this.form.get('unit')?.value ?? 'metric')) ?? UNIT_OPTIONS[0]);
  readonly math = Math;

  readonly summary = computed(() => this.result()?.summary ?? null);
  readonly breakdown = computed(() => this.result()?.breakdown ?? null);
  readonly recommendations = computed(() => this.result()?.recommendations ?? []);
  readonly riskIndicators = computed(() => this.result()?.riskIndicators ?? []);

  constructor() {
    this.calculationSub = this.form.valueChanges
      .pipe(debounceTime(80), distinctUntilChanged())
      .subscribe(() => this.calculate());

    this.effectRefs.push(
      effect(() => {
        const unit = this.form.get('unit')?.value ?? 'metric';
        if (unit === 'metric') {
          return;
        }
        const weight = toNumber(this.form.get('weight')?.value);
        const height = toNumber(this.form.get('height')?.value);
        if (weight < 1) {
          this.form.patchValue({ weight: '150' }, { emitEvent: false });
        }
        if (height < 1) {
          this.form.patchValue({ height: '65' }, { emitEvent: false });
        }
      })
    );

    this.calculate();
  }

  ngOnDestroy(): void {
    this.calculationSub.unsubscribe();
    for (const ref of this.effectRefs) {
      ref.destroy();
    }
  }

  setUnit(unit: UnitSystem): void {
    const previousUnit = this.form.get('unit')?.value ?? 'metric';
    if (unit === previousUnit) {
      return;
    }
    const currentWeight = toNumber(this.form.get('weight')?.value);
    const currentHeight = toNumber(this.form.get('height')?.value);

    const converted = convertUnits({
      from: previousUnit,
      to: unit,
      weight: currentWeight,
      height: currentHeight
    });

    this.form.patchValue(
      {
        unit,
        weight: converted.weight.toString(),
        height: converted.height.toString()
      },
      { emitEvent: true }
    );
    this.notify(`Switched to ${unit === 'metric' ? 'metric' : 'imperial'} units.`);
  }

  applyPreset(preset: BmiPreset): void {
    this.form.patchValue(
      {
        unit: preset.unit,
        weight: preset.weight,
        height: preset.height,
        age: preset.age ?? this.form.get('age')?.value ?? '',
        gender: preset.gender ?? this.form.get('gender')?.value ?? 'unspecified',
        waist: preset.waist ?? this.form.get('waist')?.value ?? ''
      },
      { emitEvent: true }
    );
    this.notify(`${preset.label} preset applied.`);
  }

  submit(): void {
    this.calculate();
    this.notify('BMI recalculated.');
  }

  clearHistory(): void {
    this.history.set([]);
    this.notify('History cleared.');
  }

  restoreHistory(entry: BmiHistory): void {
    this.form.patchValue(
      {
        unit: entry.unit,
        weight: entry.weight.toString(),
        height: entry.height.toString(),
        age: entry.age?.toString() ?? '',
        gender: entry.gender,
        waist: entry.waist?.toString() ?? ''
      },
      { emitEvent: true }
    );
    this.notify('History entry restored.');
  }

  private calculate(): void {
    this.errorMessage.set(null);

    try {
      const calculator = new BmiCalculator();
      const input: BmiInput = {
        unit: this.form.get('unit')?.value ?? 'metric',
        weight: toNumber(this.form.get('weight')?.value),
        height: toNumber(this.form.get('height')?.value),
        age: this.form.get('age')?.value ? toNumber(this.form.get('age')?.value) : undefined,
        gender: this.form.get('gender')?.value ?? 'unspecified',
        waist: this.form.get('waist')?.value ? toNumber(this.form.get('waist')?.value) : undefined
      };

      const result = calculator.calculate(input);
      this.result.set(result);

      if (this.form.get('includeHistory')?.value) {
        this.pushHistory(result, input);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to calculate BMI.';
      this.errorMessage.set(message);
      this.result.set(null);
    }
  }

  private pushHistory(result: BmiResult, input: BmiInput): void {
    const entry: BmiHistory = {
      ...result,
      unit: input.unit,
      weight: input.weight,
      height: input.height,
      age: input.age,
      gender: input.gender,
      waist: input.waist
    };

    this.history.update((current) => {
      const filtered = current.filter(
        (item) => !(item.weight === entry.weight && item.height === entry.height && item.unit === entry.unit && item.gender === entry.gender)
      );
      return [entry, ...filtered].slice(0, 8);
    });
  }

  private notify(message: string): void {
    this.statusMessage.set(message);
    setTimeout(() => this.statusMessage.set(null), 3200);
  }

  readonly trackUnit = (_: number, option: UnitOption) => option.id;
  readonly trackPreset = (_: number, preset: BmiPreset) => preset.label;
  readonly trackRecommendation = (_: number, tip: string) => tip;
  readonly trackRisk = (_: number, risk: RiskIndicator) => risk.label;
  readonly trackHistory = (_: number, entry: BmiHistory) => `${entry.unit}-${entry.weight}-${entry.height}`;

  formatWeight(value: number, unit: UnitSystem = this.form.get('unit')?.value ?? 'metric'): string {
    const converted = unit === 'metric' ? value : value * KG_TO_LB;
    const label = unit === 'metric' ? 'kg' : 'lb';
    return `${converted.toFixed(1)} ${label}`;
  }

  formatHeight(value: number, unit: UnitSystem = this.form.get('unit')?.value ?? 'metric'): string {
    const converted = unit === 'metric' ? value : value * CM_TO_IN;
    const label = unit === 'metric' ? 'cm' : 'in';
    return `${converted.toFixed(1)} ${label}`;
  }
}

type UnitSystem = 'metric' | 'imperial';
type Gender = 'male' | 'female' | 'unspecified';

type UnitOption = {
  id: UnitSystem;
  label: string;
  weightLabel: string;
  heightLabel: string;
};

type BmiPreset = {
  label: string;
  unit: UnitSystem;
  weight: string;
  height: string;
  age?: string;
  gender?: Gender;
  waist?: string;
};

type BmiInput = {
  unit: UnitSystem;
  weight: number;
  height: number;
  age?: number;
  gender: Gender;
  waist?: number;
};

type BmiResult = {
  summary: BmiSummary;
  breakdown?: BmiBreakdown;
  recommendations: string[];
  riskIndicators: RiskIndicator[];
};

type BmiSummary = {
  bmi: number;
  classification: BmiCategory;
  interpretation: string;
  idealRange: string;
  weightDifference: number;
};

type BmiBreakdown = {
  weightKg: number;
  heightM: number;
  bmi: number;
  lowerWeightLimit: number;
  upperWeightLimit: number;
};

type RiskIndicator = {
  label: string;
  level: 'low' | 'moderate' | 'high';
  description: string;
};

type BmiHistory = BmiResult & BmiInput;

type BmiCategory = (typeof BMI_CATEGORIES)[number];

type BmiTimelineSegment = {
  label: string;
  description: string;
  difference: number;
};

class BmiCalculator {
  calculate(input: BmiInput): BmiResult {
    if (input.weight <= 0 || input.height <= 0) {
      throw new Error('Weight and height must be positive values.');
    }

    const weightKg = input.unit === 'metric' ? input.weight : input.weight * LB_TO_KG;
    const heightCm = input.unit === 'metric' ? input.height : input.height * IN_TO_CM;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    const roundedBmi = Number(bmi.toFixed(1));

    const category = resolveCategory(roundedBmi);
    const interpretation = buildInterpretation(category, input.gender);
    const idealRange = computeIdealWeightRange(heightM);
    const weightDiff = computeWeightDifference(weightKg, heightM, category);

    const recommendations = buildRecommendations(category, input);
    const riskIndicators = buildRiskIndicators(category, input);

    const breakdown: BmiBreakdown = {
      weightKg,
      heightM,
      bmi: roundedBmi,
      lowerWeightLimit: idealRange.lower,
      upperWeightLimit: idealRange.upper
    };

    const summary: BmiSummary = {
      bmi: roundedBmi,
      classification: category,
      interpretation,
      idealRange: `${idealRange.lower.toFixed(1)} kg - ${idealRange.upper.toFixed(1)} kg`,
      weightDifference: weightDiff
    };

    return {
      summary,
      breakdown,
      recommendations,
      riskIndicators
    };
  }
}

function resolveCategory(bmi: number): BmiCategory {
  for (const category of BMI_CATEGORIES) {
    if (bmi >= category.min && bmi < category.max) {
      return category;
    }
  }
  return BMI_CATEGORIES[BMI_CATEGORIES.length - 1];
}

function computeIdealWeightRange(heightM: number): { lower: number; upper: number } {
  const lower = 18.5 * heightM * heightM;
  const upper = 24.9 * heightM * heightM;
  return { lower, upper };
}

function computeWeightDifference(weightKg: number, heightM: number, category: BmiCategory): number {
  if (category.id === 'healthy') {
    return 0;
  }
  if (category.min >= 25) {
    const healthyUpper = 24.9 * heightM * heightM;
    return healthyUpper - weightKg;
  }
  const healthyLower = 18.5 * heightM * heightM;
  return healthyLower - weightKg;
}

function buildRecommendations(category: BmiCategory, input: BmiInput): string[] {
  return [category.recommendation, ...getAgeRecommendations(category, input), ...getWaistRecommendations(input)];
}

function buildRiskIndicators(category: BmiCategory, input: BmiInput): RiskIndicator[] {
  return [...getCategoryRisks(category), ...getWaistRisks(input)];
}

function buildInterpretation(category: BmiCategory, gender: Gender): string {
  const base = `${category.label} range`;
  if (category.id === 'healthy') {
    return `${base}. Maintain balanced nutrition and regular activity.`;
  }
  if (category.id === 'underweight') {
    return `${base}. Consider increasing calorie intake and monitoring nutrient density.`;
  }
  if (category.id === 'overweight') {
    return `${base}. Focus on gradual weight reduction with sustainable lifestyle changes.`;
  }
  if (category.id === 'obesity' || category.id === 'severe') {
    const prefix = gender === 'female' ? 'Work with your healthcare provider to develop a supportive plan.' : 'Consult your healthcare provider about comprehensive weight management.';
    return `${base}. ${prefix}`;
  }
  return `${base}. Review your habits and consult a professional if unsure.`;
}

function numberValidator(control: import('@angular/forms').AbstractControl) {
  const raw = control.value;
  if (raw === null || raw === undefined || raw === '') {
    return null;
  }
  const value = toNumber(raw);
  if (!Number.isFinite(value)) {
    return { number: true };
  }
  if (value < 0) {
    return { positive: true };
  }
  return null;
}

function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const normalised = value.split(',').join('').trim();
  return normalised ? Number.parseFloat(normalised) : 0;
}

function convertUnits(options: { from: UnitSystem; to: UnitSystem; weight: number; height: number }): { weight: number; height: number } {
  const safeWeight = Number.isFinite(options.weight) && options.weight > 0 ? options.weight : 0;
  const safeHeight = Number.isFinite(options.height) && options.height > 0 ? options.height : 0;

  if (options.from === options.to) {
    return fallbackUnits(options.to, safeWeight, safeHeight);
  }

  return options.to === 'metric'
    ? convertToMetricUnits(safeWeight, safeHeight)
    : convertToImperialUnits(safeWeight, safeHeight);
}

function fallbackUnits(to: UnitSystem, weight: number, height: number): { weight: number; height: number } {
  if (to === 'metric') {
    return { weight: weight || 70, height: height || 175 };
  }
  return { weight: weight || 155, height: height || 69 };
}

function convertToMetricUnits(weight: number, height: number): { weight: number; height: number } {
  const convertedWeight = weight > 0 ? Number((weight * LB_TO_KG).toFixed(1)) : 70;
  const convertedHeight = height > 0 ? Number((height * IN_TO_CM).toFixed(1)) : 175;
  return { weight: convertedWeight, height: convertedHeight };
}

function convertToImperialUnits(weight: number, height: number): { weight: number; height: number } {
  const convertedWeight = weight > 0 ? Number((weight * KG_TO_LB).toFixed(1)) : 155;
  const convertedHeight = height > 0 ? Number((height * CM_TO_IN).toFixed(1)) : 69;
  return { weight: convertedWeight, height: convertedHeight };
}

const UNIT_OPTIONS: UnitOption[] = [
  { id: 'metric', label: 'Metric (kg / cm)', weightLabel: 'kg', heightLabel: 'cm' },
  { id: 'imperial', label: 'Imperial (lb / in)', weightLabel: 'lb', heightLabel: 'in' }
];

const BMI_PRESETS: BmiPreset[] = [
  { label: 'Runner', unit: 'metric', weight: '62', height: '175', age: '29', gender: 'female', waist: '70' },
  { label: 'Office worker', unit: 'metric', weight: '85', height: '178', age: '41', gender: 'male', waist: '98' },
  { label: 'Teenager', unit: 'imperial', weight: '140', height: '66', age: '17', gender: 'female' },
  { label: 'Senior', unit: 'imperial', weight: '185', height: '70', age: '66', gender: 'male', waist: '102' },
  { label: 'Average adult', unit: 'metric', weight: '74', height: '170', age: '32', gender: 'unspecified', waist: '82' }
];

const BMI_CATEGORIES = [
  { id: 'underweight', label: 'Underweight', min: 0, max: 18.5, recommendation: 'Increase wholesome calorie intake and monitor weight changes.' },
  { id: 'healthy', label: 'Healthy', min: 18.5, max: 25, recommendation: 'Maintain current lifestyle with balanced nutrition and regular activity.' },
  { id: 'overweight', label: 'Overweight', min: 25, max: 30, recommendation: 'Introduce moderate caloric deficit and increase activity to prevent progression.' },
  { id: 'obesity', label: 'Obesity', min: 30, max: 35, recommendation: 'Collaborate with healthcare provider on weight-loss strategies and monitor comorbidities.' },
  { id: 'severe', label: 'Severe obesity', min: 35, max: Number.POSITIVE_INFINITY, recommendation: 'Consider structured programs, medical supervision, and long-term support.' }
] as const;

const LB_TO_KG = 0.45359237;
const KG_TO_LB = 1 / LB_TO_KG;
const CM_TO_IN = 0.3937007874;
const IN_TO_CM = 1 / CM_TO_IN;

function getCategoryRisks(category: BmiCategory): RiskIndicator[] {
  if (category.min < 18.5) {
    return [
      {
        label: 'Nutritional risk',
        level: 'moderate',
        description: 'Maintain adequate caloric intake and monitor for signs of deficiency.'
      }
    ];
  }
  if (category.min >= 30) {
    return [
      {
        label: 'Cardiovascular risk',
        level: 'high',
        description: 'Obesity is associated with a high risk of heart disease, stroke, and type 2 diabetes.'
      }
    ];
  }
  if (category.min >= 25) {
    return [
      {
        label: 'Metabolic risk',
        level: 'moderate',
        description: 'Increased likelihood of hypertension, dyslipidemia, and insulin resistance.'
      }
    ];
  }
  return [];
}

function getWaistRisks(input: BmiInput): RiskIndicator[] {
  if (!input.waist) {
    return [];
  }
  const highRisk = (input.gender === 'male' && input.waist > 102) || (input.gender === 'female' && input.waist > 88);
  if (!highRisk) {
    return [];
  }
  return [
    {
      label: 'Central adiposity',
      level: 'high',
      description: 'High waist circumference adds risk beyond BMI. Focus on reducing abdominal fat.'
    }
  ];
}

function getAgeRecommendations(category: BmiCategory, input: BmiInput): string[] {
  if (!input.age) {
    return [];
  }
  const tips: string[] = [];
  if (input.age > 50 && category.min >= 25) {
    tips.push('Discuss weight management targets with your healthcare provider considering age-related factors.');
  }
  if (input.age < 18) {
    tips.push('For people under 18, consult growth charts for age-adjusted BMI interpretations.');
  }
  return tips;
}

function getWaistRecommendations(input: BmiInput): string[] {
  if (!input.waist) {
    return [];
  }
  const threshold = input.gender === 'male' ? 102 : 88;
  if (input.gender === 'unspecified' || input.waist <= threshold) {
    return [];
  }
  return ['Elevated waist circumference suggests higher cardiometabolic risk; consider waist reduction strategies.'];
}
