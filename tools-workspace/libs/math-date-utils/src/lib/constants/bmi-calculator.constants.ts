import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type {
  BmiCalculatorFormValues,
  BmiCategory,
  BmiPreset,
  UnitOption
} from '../types/bmi-calculator.types';

export const LB_TO_KG = 0.45359237;
export const KG_TO_LB = 1 / LB_TO_KG;
export const CM_TO_IN = 0.3937007874;
export const IN_TO_CM = 1 / CM_TO_IN;

export const BMI_HISTORY_LIMIT = 8;

export const BMI_DEFAULT_FORM: BmiCalculatorFormValues = {
  unit: 'metric',
  weight: '70',
  height: '175',
  age: '28',
  gender: 'unspecified',
  waist: '',
  includeHistory: true
};

export const BMI_UNIT_OPTIONS: ReadonlyArray<UnitOption> = [
  { id: 'metric', label: 'Metric (kg / cm)', weightLabel: 'kg', heightLabel: 'cm' },
  { id: 'imperial', label: 'Imperial (lb / in)', weightLabel: 'lb', heightLabel: 'in' }
];

export const BMI_PRESETS: ReadonlyArray<BmiPreset> = [
  {
    label: 'Runner',
    unit: 'metric',
    weight: '62',
    height: '175',
    age: '29',
    gender: 'female',
    waist: '70'
  },
  {
    label: 'Office worker',
    unit: 'metric',
    weight: '85',
    height: '178',
    age: '41',
    gender: 'male',
    waist: '98'
  },
  {
    label: 'Teenager',
    unit: 'imperial',
    weight: '140',
    height: '66',
    age: '17',
    gender: 'female'
  },
  {
    label: 'Senior',
    unit: 'imperial',
    weight: '185',
    height: '70',
    age: '66',
    gender: 'male',
    waist: '102'
  },
  {
    label: 'Average adult',
    unit: 'metric',
    weight: '74',
    height: '170',
    age: '32',
    gender: 'unspecified',
    waist: '82'
  }
];

export const BMI_CATEGORIES: ReadonlyArray<BmiCategory> = [
  {
    id: 'underweight',
    label: 'Underweight',
    min: 0,
    max: 18.5,
    recommendation: 'Increase wholesome calorie intake and monitor weight changes.'
  },
  {
    id: 'healthy',
    label: 'Healthy',
    min: 18.5,
    max: 25,
    recommendation: 'Maintain current lifestyle with balanced nutrition and regular activity.'
  },
  {
    id: 'overweight',
    label: 'Overweight',
    min: 25,
    max: 30,
    recommendation:
      'Introduce moderate caloric deficit and increase activity to prevent progression.'
  },
  {
    id: 'obesity',
    label: 'Obesity',
    min: 30,
    max: 35,
    recommendation:
      'Collaborate with healthcare provider on weight-loss strategies and monitor comorbidities.'
  },
  {
    id: 'severe',
    label: 'Severe obesity',
    min: 35,
    max: Number.POSITIVE_INFINITY,
    recommendation: 'Consider structured programs, medical supervision, and long-term support.'
  }
];

export const BMI_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Unit Converter',
    path: '/math-date-utils/unit-converter',
    description: 'Convert kg/lb or cm/in before entering measurements'
  },
  {
    label: 'Age Calculator',
    path: '/math-date-utils/age-calculator',
    description: 'Age-aware context for BMI and growth discussions'
  },
  {
    label: 'Percentage Calculator',
    path: '/math-date-utils/percentage-calculator',
    description: 'Estimate relative change toward a healthy weight range'
  },
  {
    label: 'Tip Calculator',
    path: '/math-date-utils/tip-calculator',
    description: 'Quick splits when tracking meal or grocery budgets'
  }
];

/** Waist circumference high-risk thresholds in centimeters. */
export const BMI_WAIST_RISK_CM = {
  male: 102,
  female: 88
} as const;
