import {
  UNIT_CONVERTER_BASE_PRECISION
} from '../constants/unit-converter.constants';
import { UNIT_INDEXES } from '../constants/unit-converter.units';
import type { MdToolSuggestion } from '../shared/md-tool-suggestion.model';
import type {
  ConversionResult,
  UnitDefinition,
  UnitSuggestionContext,
  UnitType
} from '../types/unit-converter.types';

export class ConversionEngine {
  constructor(private readonly units: Readonly<Record<string, UnitDefinition>>) {}

  convert(value: number, fromUnitId: string, toUnitId: string): ConversionResult {
    const fromUnit = this.units[fromUnitId];
    const toUnit = this.units[toUnitId];

    if (!fromUnit || !toUnit) {
      throw new ReferenceError('Unknown unit');
    }

    if (Number.isNaN(value) || !Number.isFinite(value)) {
      throw new TypeError('Invalid input value');
    }

    if (fromUnit.type !== toUnit.type) {
      throw new TypeError('Mismatched conversion types');
    }

    const fromDimension = fromUnit.dimension ?? fromUnit.type;
    const toDimension = toUnit.dimension ?? toUnit.type;

    if (fromDimension !== toDimension) {
      throw new TypeError('Incompatible unit dimensions');
    }

    const baseValue = fromUnit.toBase(value);
    const convertedValue = toUnit.fromBase(baseValue);
    const precision = toUnit.precision ?? Math.min(UNIT_CONVERTER_BASE_PRECISION, 8);

    return {
      inputValue: value,
      inputUnit: fromUnit,
      outputValue: convertedValue,
      outputUnit: toUnit,
      timestamp: Date.now(),
      formula: this.buildFormula(fromUnit, toUnit),
      precision
    };
  }

  private buildFormula(fromUnit: UnitDefinition, toUnit: UnitDefinition): string {
    if (fromUnit === toUnit) {
      return 'value';
    }

    if (fromUnit.type === 'temperature') {
      if (fromUnit.id === 'celsius' && toUnit.id === 'fahrenheit') {
        return '(value × 9 ÷ 5) + 32';
      }

      if (fromUnit.id === 'fahrenheit' && toUnit.id === 'celsius') {
        return '(value - 32) × 5 ÷ 9';
      }

      if (fromUnit.id === 'celsius' && toUnit.id === 'kelvin') {
        return 'value + 273.15';
      }
    }

    if (fromUnit.type === 'data') {
      return `${fromUnit.symbol ?? fromUnit.label} → ${toUnit.symbol ?? toUnit.label}`;
    }

    if (fromUnit.type === 'currency') {
      return 'value × latestRate';
    }

    return 'value × factor';
  }
}

export function createDefaultConversionEngine(): ConversionEngine {
  return new ConversionEngine(UNIT_INDEXES);
}

export function formatUnitNumber(value: number, precision = 6): string {
  if (!Number.isFinite(value)) {
    return '—';
  }

  const safePrecision = Math.min(Math.max(0, precision), 12);
  return value.toLocaleString(undefined, {
    maximumFractionDigits: safePrecision
  });
}

export function formatUnitLabel(unit: UnitDefinition): string {
  const symbol = unit.symbol ?? unit.id;
  return unit.symbol ? `${unit.label} (${symbol})` : unit.label;
}

export function formatConversionSummary(result: ConversionResult): string {
  const inputUnitLabel = result.inputUnit.symbol ?? result.inputUnit.label;
  const outputUnitLabel = result.outputUnit.symbol ?? result.outputUnit.label;
  const precision = result.precision ?? 6;
  return `${formatUnitNumber(result.inputValue, precision)} ${inputUnitLabel} = ${formatUnitNumber(result.outputValue, precision)} ${outputUnitLabel}`;
}

export function formatHistoryMeta(result: ConversionResult, now = Date.now()): string {
  const elapsedMs = now - result.timestamp;
  const minutes = Math.floor(elapsedMs / 60000);

  if (minutes < 1) {
    return 'moments ago';
  }

  if (minutes < 60) {
    return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days > 1 ? 's' : ''} ago`;
}

export function mapConversionError(error: unknown): string {
  return error instanceof Error ? error.message : 'Conversion failed.';
}

export function resolveUnitSuggestion(
  context: UnitSuggestionContext
): MdToolSuggestion | null {
  const { hasResult, hasError, category, inputUnitId, outputUnitId, inputValue } = context;

  if (hasError) {
    return {
      id: 'uc-validation',
      title: 'Check conversion inputs',
      reason:
        'Enter a finite number and pick compatible units in the same category. Percentage Calculator helps when you need a scale factor instead.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && category === 'currency') {
    return {
      id: 'uc-currency',
      title: 'Currency conversion selected',
      reason:
        'Currency Converter provides live FX rates; this category uses cached mock rates for offline demos.',
      actionLabel: 'Open Currency Converter',
      path: '/math-date-utils/currency-converter'
    };
  }

  if (hasResult && category === 'temperature') {
    return {
      id: 'uc-temperature',
      title: 'Temperature conversion ready',
      reason:
        'Offset-aware scales are applied. Number to Words can spell out readings for reports or labels.',
      actionLabel: 'Open Number to Words',
      path: '/math-date-utils/number-to-words'
    };
  }

  if (hasResult && category === 'data') {
    return {
      id: 'uc-data',
      title: 'Data size conversion',
      reason:
        'Decimal (KB/GB) and binary (KiB/GiB) bases differ. Fraction Calculator helps express the ratio between them.',
      actionLabel: 'Open Fraction Calculator',
      path: '/math-date-utils/fraction-calculator'
    };
  }

  if (hasResult && inputUnitId === outputUnitId) {
    return {
      id: 'uc-same-unit',
      title: 'Same unit selected',
      reason:
        'From and To match. Swap units or pick a different target—Percentage Calculator can still show relative change.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  if (hasResult && Math.abs(inputValue) >= 1_000_000) {
    return {
      id: 'uc-large',
      title: 'Very large input value',
      reason:
        'Number to Words helps present large converted totals in documents without scientific notation.',
      actionLabel: 'Open Number to Words',
      path: '/math-date-utils/number-to-words'
    };
  }

  if (hasResult) {
    return {
      id: 'uc-general',
      title: 'Need a related calculation?',
      reason:
        'Percentage Calculator and Fraction Calculator help when you need factors or ratios alongside the converted value.',
      actionLabel: 'Open Percentage Calculator',
      path: '/math-date-utils/percentage-calculator'
    };
  }

  return {
    id: 'uc-start',
    title: 'Pick a category and enter a value',
    reason:
      'Convert across length, mass, temperature, data, and more. Related tools help with FX, percents, and wording.',
    actionLabel: 'Open Currency Converter',
    path: '/math-date-utils/currency-converter'
  };
}

export function filterCategoriesByTerm<T extends { title: string; description: string; featuredUnits: string[] }>(
  categories: ReadonlyArray<T>,
  term: string,
  unitIndexes: Readonly<Record<string, UnitDefinition>>
): T[] {
  const normalised = term.trim().toLowerCase();
  if (!normalised) {
    return [...categories];
  }

  return categories.filter((category) => {
    const matchesTitle = category.title.toLowerCase().includes(normalised);
    const matchesDescription = category.description.toLowerCase().includes(normalised);
    const matchesFeatured = category.featuredUnits.some((unitId) =>
      unitIndexes[unitId]?.label.toLowerCase().includes(normalised)
    );
    return matchesTitle || matchesDescription || matchesFeatured;
  });
}

export type { UnitType };
