import { AbstractControl, ValidationErrors } from '@angular/forms';
import {
  BMI_CATEGORIES,
  BMI_HISTORY_LIMIT,
  BMI_WAIST_RISK_CM,
  CM_TO_IN,
  IN_TO_CM,
  KG_TO_LB,
  LB_TO_KG
} from '../constants/bmi-calculator.constants';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  BmiBreakdown,
  BmiCategory,
  BmiHistory,
  BmiInput,
  BmiResult,
  BmiSuggestionContext,
  BmiSummary,
  Gender,
  RiskIndicator,
  UnitSystem
} from '../types/bmi-calculator.types';

export function calculateBmi(input: BmiInput): BmiResult {
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

export function resolveCategory(bmi: number): BmiCategory {
  for (const category of BMI_CATEGORIES) {
    if (bmi >= category.min && bmi < category.max) {
      return category;
    }
  }
  return BMI_CATEGORIES[BMI_CATEGORIES.length - 1];
}

export function computeIdealWeightRange(heightM: number): { lower: number; upper: number } {
  const lower = 18.5 * heightM * heightM;
  const upper = 24.9 * heightM * heightM;
  return { lower, upper };
}

export function computeWeightDifference(
  weightKg: number,
  heightM: number,
  category: BmiCategory
): number {
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

export function buildRecommendations(category: BmiCategory, input: BmiInput): string[] {
  return [category.recommendation, ...getAgeRecommendations(category, input), ...getWaistRecommendations(input)];
}

export function buildRiskIndicators(category: BmiCategory, input: BmiInput): RiskIndicator[] {
  return [...getCategoryRisks(category), ...getWaistRisks(input)];
}

export function buildInterpretation(category: BmiCategory, gender: Gender): string {
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
    const prefix =
      gender === 'female'
        ? 'Work with your healthcare provider to develop a supportive plan.'
        : 'Consult your healthcare provider about comprehensive weight management.';
    return `${base}. ${prefix}`;
  }
  return `${base}. Review your habits and consult a professional if unsure.`;
}

export function numberValidator(control: AbstractControl): ValidationErrors | null {
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

export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) {
    return 0;
  }
  if (typeof value === 'number') {
    return value;
  }
  const normalised = value.split(',').join('').trim();
  return normalised ? Number.parseFloat(normalised) : 0;
}

export function convertUnits(options: {
  from: UnitSystem;
  to: UnitSystem;
  weight: number;
  height: number;
}): { weight: number; height: number } {
  const safeWeight = Number.isFinite(options.weight) && options.weight > 0 ? options.weight : 0;
  const safeHeight = Number.isFinite(options.height) && options.height > 0 ? options.height : 0;

  if (options.from === options.to) {
    return fallbackUnits(options.to, safeWeight, safeHeight);
  }

  return options.to === 'metric'
    ? convertToMetricUnits(safeWeight, safeHeight)
    : convertToImperialUnits(safeWeight, safeHeight);
}

export function fallbackUnits(
  to: UnitSystem,
  weight: number,
  height: number
): { weight: number; height: number } {
  if (to === 'metric') {
    return { weight: weight || 70, height: height || 175 };
  }
  return { weight: weight || 155, height: height || 69 };
}

export function convertToMetricUnits(weight: number, height: number): { weight: number; height: number } {
  const convertedWeight = weight > 0 ? Number((weight * LB_TO_KG).toFixed(1)) : 70;
  const convertedHeight = height > 0 ? Number((height * IN_TO_CM).toFixed(1)) : 175;
  return { weight: convertedWeight, height: convertedHeight };
}

export function convertToImperialUnits(
  weight: number,
  height: number
): { weight: number; height: number } {
  const convertedWeight = weight > 0 ? Number((weight * KG_TO_LB).toFixed(1)) : 155;
  const convertedHeight = height > 0 ? Number((height * CM_TO_IN).toFixed(1)) : 69;
  return { weight: convertedWeight, height: convertedHeight };
}

export function getCategoryRisks(category: BmiCategory): RiskIndicator[] {
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
        description:
          'Obesity is associated with a high risk of heart disease, stroke, and type 2 diabetes.'
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

export function getWaistRisks(input: BmiInput): RiskIndicator[] {
  if (!input.waist) {
    return [];
  }
  const highRisk =
    (input.gender === 'male' && input.waist > BMI_WAIST_RISK_CM.male) ||
    (input.gender === 'female' && input.waist > BMI_WAIST_RISK_CM.female);
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

export function getAgeRecommendations(category: BmiCategory, input: BmiInput): string[] {
  if (!input.age) {
    return [];
  }
  const tips: string[] = [];
  if (input.age > 50 && category.min >= 25) {
    tips.push(
      'Discuss weight management targets with your healthcare provider considering age-related factors.'
    );
  }
  if (input.age < 18) {
    tips.push('For people under 18, consult growth charts for age-adjusted BMI interpretations.');
  }
  return tips;
}

export function getWaistRecommendations(input: BmiInput): string[] {
  if (!input.waist) {
    return [];
  }
  const threshold = input.gender === 'male' ? BMI_WAIST_RISK_CM.male : BMI_WAIST_RISK_CM.female;
  if (input.gender === 'unspecified' || input.waist <= threshold) {
    return [];
  }
  return [
    'Elevated waist circumference suggests higher cardiometabolic risk; consider waist reduction strategies.'
  ];
}

export function formatWeightDisplay(valueKgOrInput: number, unit: UnitSystem): string {
  const converted = unit === 'metric' ? valueKgOrInput : valueKgOrInput * KG_TO_LB;
  const label = unit === 'metric' ? 'kg' : 'lb';
  return `${converted.toFixed(1)} ${label}`;
}

export function formatHeightDisplay(valueCmOrInput: number, unit: UnitSystem): string {
  const converted = unit === 'metric' ? valueCmOrInput : valueCmOrInput * CM_TO_IN;
  const label = unit === 'metric' ? 'cm' : 'in';
  return `${converted.toFixed(1)} ${label}`;
}

export function formatBmiResultText(result: BmiResult): string {
  const summary = result.summary;
  return [
    `BMI: ${summary.bmi.toFixed(1)}`,
    `Classification: ${summary.classification.label}`,
    summary.interpretation,
    `Ideal range: ${summary.idealRange}`
  ].join('\n');
}

export function prependBmiHistory(
  current: BmiHistory[],
  entry: BmiHistory,
  limit: number = BMI_HISTORY_LIMIT
): BmiHistory[] {
  const filtered = current.filter(
    (item) =>
      !(
        item.weight === entry.weight &&
        item.height === entry.height &&
        item.unit === entry.unit &&
        item.gender === entry.gender
      )
  );
  return [entry, ...filtered].slice(0, limit);
}

export function hasHighWaistRisk(input: Pick<BmiInput, 'gender' | 'waist'>): boolean {
  if (!input.waist) {
    return false;
  }
  return (
    (input.gender === 'male' && input.waist > BMI_WAIST_RISK_CM.male) ||
    (input.gender === 'female' && input.waist > BMI_WAIST_RISK_CM.female)
  );
}

export function resolveBmiSuggestion(context: BmiSuggestionContext): MdToolSuggestion | null {
  const { hasResult, hasError, categoryId, age, hasWaist, hasHighWaistRisk, unit } = context;

  if (hasError) {
    return {
      id: 'bmi-positive-values',
      title: 'Need positive measurements',
      reason:
        'Weight and height must be greater than zero. Unit Converter can help if you are switching between kg/lb or cm/in.',
      actionLabel: 'Open Unit Converter',
      path: '/math-date-utils/unit-converter'
    };
  }

  if (hasResult && age !== undefined && age < 18) {
    return {
      id: 'bmi-teen',
      title: 'Youth BMI needs context',
      reason:
        'For people under 18, adult BMI charts can mislead. Age Calculator helps frame age-adjusted discussions with a clinician.',
      actionLabel: 'Open Age Calculator',
      path: '/math-date-utils/age-calculator'
    };
  }

  if (hasResult && hasHighWaistRisk) {
    return {
      id: 'bmi-waist',
      title: 'Waist risk flagged',
      reason:
        'Central adiposity raises cardiometabolic risk beyond BMI. Percentage Calculator can help track progress toward a waist or weight goal.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && (categoryId === 'obesity' || categoryId === 'severe' || categoryId === 'underweight')) {
    return {
      id: 'bmi-clinical',
      title: 'Outside the healthy BMI band',
      reason:
        'Consider clinician-guided goals. Percentage Calculator helps estimate how far current weight sits from a target range.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && unit === 'imperial' && !hasWaist) {
    return {
      id: 'bmi-waist-optional',
      title: 'Add waist for richer risk insights',
      reason:
        'Waist is entered in centimeters. Use Unit Converter if you measured in inches, then paste the cm value here.',
      actionLabel: 'Open Unit Converter',
      path: '/math-date-utils/unit-converter'
    };
  }

  if (hasResult && categoryId === 'healthy') {
    return {
      id: 'bmi-maintain',
      title: 'Healthy range — keep tracking',
      reason:
        'Age Calculator pairs well with periodic BMI checks when discussing long-term wellness targets.',
      actionLabel: 'Open Age Calculator',
      path: '/math-date-utils/age-calculator'
    };
  }

  if (hasResult) {
    return {
      id: 'bmi-units',
      title: 'Switching measurement systems?',
      reason:
        'Unit Converter converts weight and height so you can keep BMI inputs consistent across metric and imperial.',
      actionLabel: 'Open Unit Converter',
      path: '/math-date-utils/unit-converter'
    };
  }

  return {
    id: 'bmi-start',
    title: 'Enter weight and height',
    reason:
      'BMI updates live as you type. Unit Converter is handy if your scale and tape use different systems.',
    actionLabel: 'Open Unit Converter',
    path: '/math-date-utils/unit-converter'
  };
}

export function mapBmiCalculationError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unable to calculate BMI.';
}

export function buildBmiInputFromValues(values: {
  unit: UnitSystem;
  weight: string;
  height: string;
  age: string;
  gender: Gender;
  waist: string;
}): BmiInput {
  return {
    unit: values.unit,
    weight: toNumber(values.weight),
    height: toNumber(values.height),
    age: values.age ? toNumber(values.age) : undefined,
    gender: values.gender,
    waist: values.waist ? toNumber(values.waist) : undefined
  };
}
