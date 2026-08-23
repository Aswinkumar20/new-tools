import { Routes } from '@angular/router';

export const MATH_DATE_UTILS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'unit-converter',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/unit-converter/unit-converter').then(m => m.UnitConverterComponent),
  },
  {
    path: 'number-to-words',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/number-to-words/number-to-words').then(m => m.NumberToWordsComponent),
  },
  {
    path: 'percentage-calculator',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/percentage-calculator/percentage-calculator').then(m => m.PercentageCalculatorComponent),
  },
  {
    path: 'age-calculator',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/age-calculator/age-calculator').then(m => m.AgeCalculatorComponent),
  },
  {
    path: 'date-difference-calculator',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/date-difference-calculator/date-difference-calculator').then(m => m.DateDifferenceCalculatorComponent),
  },
  {
    path: 'simple-compound-interest-calculator',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/simple-compound-interest-calculator/simple-compound-interest-calculator').then(m => m.SimpleCompoundInterestCalculatorComponent),
  },
  {
    path: 'bmi-calculator',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/bmi-calculator/bmi-calculator').then(m => m.BmiCalculatorComponent),
  },
  {
    path: 'loan-emi-calculator',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/loan-emi-calculator/loan-emi-calculator').then(m => m.LoanEmiCalculatorComponent),
  },
  {
    path: 'tip-calculator',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/tip-calculator/tip-calculator').then(m => m.TipCalculatorComponent),
  },
  {
    path: 'currency-converter',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/currency-converter/currency-converter').then(m => m.CurrencyConverterComponent),
  },
  {
    path: 'fraction-calculator',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/fraction-calculator/fraction-calculator').then(m => m.FractionCalculatorComponent),
  },
  {
    path: 'date-to-day-of-week',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/date-to-day-of-week/date-to-day-of-week').then(m => m.DateToDayOfWeekComponent),
  },
  {
    path: 'zodiac-finder',
    loadComponent: () =>
      import('@tools-workspace/math-date-utils/zodiac-finder/zodiac-finder').then(m => m.ZodiacFinderComponent),
  },
];
