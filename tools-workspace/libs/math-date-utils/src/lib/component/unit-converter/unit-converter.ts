import { CommonModule } from '@angular/common';
import { Component, computed, effect, ElementRef, inject, OnDestroy, signal, Signal, ViewChild, WritableSignal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, defer, distinctUntilChanged, map, Observable, of, shareReplay, startWith, Subscription, switchMap, tap } from 'rxjs';
import { Navigation } from '@tools-workspace/features-home';

type UnitType =
  | 'length'
  | 'area'
  | 'volume'
  | 'weight'
  | 'temperature'
  | 'time'
  | 'speed'
  | 'acceleration'
  | 'energy'
  | 'power'
  | 'force'
  | 'pressure'
  | 'density'
  | 'torque'
  | 'flowRate'
  | 'frequency'
  | 'angle'
  | 'illuminance'
  | 'luminance'
  | 'radiation'
  | 'magneticField'
  | 'capacitance'
  | 'resistance'
  | 'inductance'
  | 'electricCharge'
  | 'electricCurrent'
  | 'electricPotential'
  | 'conductance'
  | 'impedance'
  | 'surfaceTension'
  | 'data'
  | 'currency';

interface UnitDefinition {
  id: string;
  label: string;
  symbol?: string;
  aliases?: string[];
  type: UnitType;
  dimension?: string;
  toBase: (value: number) => number;
  fromBase: (value: number) => number;
  notes?: string;
  precision?: number;
}

interface CategoryDefinition {
  id: UnitType;
  title: string;
  description: string;
  primary: string;
  featuredUnits: string[];
  icon: string;
  source?: 'internal' | 'external';
  meta?: Record<string, string>;
}

interface ConversionResult {
  inputValue: number;
  inputUnit: UnitDefinition;
  outputValue: number;
  outputUnit: UnitDefinition;
  timestamp: number;
  formula?: string;
  precision: number;
}

interface ConversionPreset {
  id: string;
  name: string;
  category: UnitType;
  inputUnit: string;
  outputUnit: string;
  createdAt: number;
}

interface QuickConversionShortcut {
  id: string;
  label: string;
  detail: string;
  category: UnitType;
  inputUnit: string;
  outputUnit: string;
}

type PromptFn = (message?: string, defaultValue?: string) => string | null;

interface ExternalRateProvider {
  id: string;
  label: string;
  fetchRates: () => Observable<Record<string, number>>;
  ttl: number;
}

const BASE_PRECISION = 12;

const BASE_UNITS: Record<UnitType, string> = {
  length: 'meter',
  area: 'squareMeter',
  volume: 'cubicMeter',
  weight: 'kilogram',
  temperature: 'kelvin',
  time: 'second',
  speed: 'meterPerSecond',
  acceleration: 'meterPerSecondSquared',
  energy: 'joule',
  power: 'watt',
  force: 'newton',
  pressure: 'pascal',
  density: 'kilogramPerCubicMeter',
  torque: 'newtonMeter',
  flowRate: 'cubicMeterPerSecond',
  frequency: 'hertz',
  angle: 'radian',
  illuminance: 'lux',
  luminance: 'candelaPerSquareMeter',
  radiation: 'gray',
  magneticField: 'tesla',
  capacitance: 'farad',
  resistance: 'ohm',
  inductance: 'henry',
  electricCharge: 'coulomb',
  electricCurrent: 'ampere',
  electricPotential: 'volt',
  conductance: 'siemens',
  impedance: 'impedanceOhm',
  surfaceTension: 'newtonPerMeter',
  data: 'byte',
  currency: 'usd'
};

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'length',
    title: 'Length & Distance',
    description: 'Metric and imperial conversions at any scale.',
    primary: 'meter',
    featuredUnits: ['meter', 'kilometer', 'mile', 'foot', 'inch', 'lightYear'],
    icon: 'ruler'
  },
  {
    id: 'area',
    title: 'Area',
    description: 'Planar measurements for land, design, and mapping.',
    primary: 'squareMeter',
    featuredUnits: ['squareMeter', 'squareKilometer', 'hectare', 'acre', 'squareFoot', 'squareInch'],
    icon: 'grid'
  },
  {
    id: 'temperature',
    title: 'Temperature',
    description: 'Offset-aware conversions across major scales.',
    primary: 'celsius',
    featuredUnits: ['celsius', 'fahrenheit', 'kelvin', 'rankine'],
    icon: 'temperature'
  },
  {
    id: 'weight',
    title: 'Mass & Weight',
    description: 'From milligrams to metric tons.',
    primary: 'kilogram',
    featuredUnits: ['kilogram', 'gram', 'tonne', 'pound', 'ounce'],
    icon: 'scale'
  },
  {
    id: 'volume',
    title: 'Volume & Capacity',
    description: 'Liquid and cubic conversions for labs and kitchens.',
    primary: 'liter',
    featuredUnits: ['liter', 'milliliter', 'gallonUS', 'cubicMeter', 'cubicFoot'],
    icon: 'beaker'
  },
  {
    id: 'time',
    title: 'Time',
    description: 'From nanoseconds to decades with calendar awareness.',
    primary: 'second',
    featuredUnits: ['second', 'minute', 'hour', 'day', 'week', 'year'],
    icon: 'clock',
    meta: { calendar: 'ISO-8601' }
  },
  {
    id: 'speed',
    title: 'Speed & Velocity',
    description: 'Instant and average rates including Mach and knots.',
    primary: 'meterPerSecond',
    featuredUnits: ['meterPerSecond', 'kilometerPerHour', 'milePerHour', 'knot', 'mach'],
    icon: 'speedometer'
  },
  {
    id: 'acceleration',
    title: 'Acceleration',
    description: 'Linear acceleration and g-force comparisons.',
    primary: 'meterPerSecondSquared',
    featuredUnits: ['meterPerSecondSquared', 'footPerSecondSquared', 'gForce'],
    icon: 'accelerate'
  },
  {
    id: 'energy',
    title: 'Energy & Heat',
    description: 'Thermal, mechanical, and electrical energy units.',
    primary: 'joule',
    featuredUnits: ['joule', 'kilojoule', 'calorie', 'kilowattHour', 'btu'],
    icon: 'bolt'
  },
  {
    id: 'power',
    title: 'Power',
    description: 'Rate of energy transfer including horsepower and BTU/hr.',
    primary: 'watt',
    featuredUnits: ['watt', 'kilowatt', 'horsepower', 'btuPerHour'],
    icon: 'flash'
  },
  {
    id: 'force',
    title: 'Force',
    description: 'Mechanical force units from dynes to kilonewtons.',
    primary: 'newton',
    featuredUnits: ['newton', 'kilonewton', 'poundForce', 'kilogramForce', 'dyne'],
    icon: 'weight'
  },
  {
    id: 'pressure',
    title: 'Pressure & Stress',
    description: 'Fluid pressure and material stress conversions.',
    primary: 'pascal',
    featuredUnits: ['pascal', 'kilopascal', 'bar', 'psi', 'atmosphere'],
    icon: 'gauge'
  },
  {
    id: 'density',
    title: 'Density',
    description: 'Mass per unit volume across systems.',
    primary: 'kilogramPerCubicMeter',
    featuredUnits: ['kilogramPerCubicMeter', 'gramPerCubicCentimeter', 'poundPerCubicFoot', 'poundPerGallonUS'],
    icon: 'cube'
  },
  {
    id: 'torque',
    title: 'Torque & Moment',
    description: 'Rotational force units for engineering and mechanics.',
    primary: 'newtonMeter',
    featuredUnits: ['newtonMeter', 'poundFoot', 'kilogramCentimeter', 'dyneCentimeter'],
    icon: 'torque'
  },
  {
    id: 'flowRate',
    title: 'Flow Rate',
    description: 'Volumetric flow conversions for labs and industry.',
    primary: 'cubicMeterPerSecond',
    featuredUnits: ['cubicMeterPerSecond', 'literPerMinute', 'gallonPerMinute', 'cubicFootPerSecond'],
    icon: 'wave'
  },
  {
    id: 'frequency',
    title: 'Frequency',
    description: 'Oscillation rates across acoustic and RF domains.',
    primary: 'hertz',
    featuredUnits: ['hertz', 'kilohertz', 'megahertz', 'gigahertz', 'revolutionsPerMinute'],
    icon: 'waveform'
  },
  {
    id: 'angle',
    title: 'Angle',
    description: 'Angular measures for navigation and design.',
    primary: 'radian',
    featuredUnits: ['radian', 'degree', 'gradian', 'arcMinute', 'arcSecond'],
    icon: 'angle'
  },
  {
    id: 'illuminance',
    title: 'Illuminance',
    description: 'Light intensity across surfaces.',
    primary: 'lux',
    featuredUnits: ['lux', 'footCandle', 'phot', 'lumenPerSquareFoot'],
    icon: 'lightbulb'
  },
  {
    id: 'luminance',
    title: 'Luminance',
    description: 'Perceived brightness for displays and lighting.',
    primary: 'candelaPerSquareMeter',
    featuredUnits: ['candelaPerSquareMeter', 'nit', 'footLambert', 'candelaPerSquareFoot'],
    icon: 'display'
  },
  {
    id: 'radiation',
    title: 'Radiation Dose & Activity',
    description: 'Common radiation dose/activity unit conversions.',
    primary: 'gray',
    featuredUnits: ['gray', 'sievert', 'rad', 'becquerel', 'curie'],
    icon: 'radiation'
  },
  {
    id: 'magneticField',
    title: 'Magnetic Field',
    description: 'Magnetic flux density and field strength units.',
    primary: 'tesla',
    featuredUnits: ['tesla', 'gauss', 'weberPerSquareMeter', 'ampereTurnPerMeter'],
    icon: 'magnet'
  },
  {
    id: 'capacitance',
    title: 'Capacitance',
    description: 'Electronic capacitance units from Farads to picofarads.',
    primary: 'farad',
    featuredUnits: ['farad', 'millifarad', 'microfarad', 'nanofarad', 'picofarad'],
    icon: 'capacitor'
  },
  {
    id: 'resistance',
    title: 'Resistance',
    description: 'Electrical resistance units.',
    primary: 'ohm',
    featuredUnits: ['ohm', 'milliohm', 'kiloohm', 'megaohm'],
    icon: 'resistor'
  },
  {
    id: 'inductance',
    title: 'Inductance',
    description: 'Electromagnetic inductance measures.',
    primary: 'henry',
    featuredUnits: ['henry', 'millihenry', 'microhenry', 'nanohenry'],
    icon: 'inductor'
  },
  {
    id: 'electricCharge',
    title: 'Electric Charge',
    description: 'Charge storage and flow units.',
    primary: 'coulomb',
    featuredUnits: ['coulomb', 'ampereHour', 'milliampereHour', 'faraday'],
    icon: 'charge'
  },
  {
    id: 'electricCurrent',
    title: 'Electric Current',
    description: 'Current measurements for circuits and power.',
    primary: 'ampere',
    featuredUnits: ['ampere', 'milliampere', 'microampere', 'kiloampere'],
    icon: 'current'
  },
  {
    id: 'electricPotential',
    title: 'Electric Potential',
    description: 'Voltage conversions across scales.',
    primary: 'volt',
    featuredUnits: ['volt', 'millivolt', 'microvolt', 'kilovolt'],
    icon: 'voltage'
  },
  {
    id: 'conductance',
    title: 'Conductance',
    description: 'Electrical conductance and admittance units.',
    primary: 'siemens',
    featuredUnits: ['siemens', 'millisiemens', 'microsiemens', 'mho'],
    icon: 'conductance'
  },
  {
    id: 'impedance',
    title: 'Impedance',
    description: 'AC circuit impedance comparisons.',
    primary: 'impedanceOhm',
    featuredUnits: ['impedanceOhm', 'impedanceKiloohm', 'impedanceMegaohm', 'impedanceMilliohm'],
    icon: 'impedance'
  },
  {
    id: 'surfaceTension',
    title: 'Surface Tension',
    description: 'Fluid surface tension unit conversions.',
    primary: 'newtonPerMeter',
    featuredUnits: ['newtonPerMeter', 'dynePerCentimeter', 'poundForcePerInch'],
    icon: 'droplet'
  },
  {
    id: 'data',
    title: 'Data & Storage',
    description: 'Binary and decimal data sizes with transfer rates.',
    primary: 'byte',
    featuredUnits: ['bit', 'byte', 'kilobyte', 'kibibyte', 'gigabyte', 'gibibyte'],
    icon: 'database',
    meta: { base: 'decimal/binary aware' }
  },
  {
    id: 'currency',
    title: 'Currency',
    description: 'Live FX rates across global currencies.',
    primary: 'usd',
    featuredUnits: ['usd', 'eur', 'gbp', 'jpy', 'inr'],
    icon: 'currencyExchange',
    source: 'external'
  }
];

const QUICK_SHORTCUTS: QuickConversionShortcut[] = [
  {
    id: 'shortcut-length',
    label: 'Length',
    detail: 'Meters ↔ Feet',
    category: 'length',
    inputUnit: 'meter',
    outputUnit: 'foot'
  },
  {
    id: 'shortcut-temperature',
    label: 'Temperature',
    detail: 'Celsius ↔ Fahrenheit',
    category: 'temperature',
    inputUnit: 'celsius',
    outputUnit: 'fahrenheit'
  },
  {
    id: 'shortcut-pressure',
    label: 'Pressure',
    detail: 'Bar ↔ PSI',
    category: 'pressure',
    inputUnit: 'bar',
    outputUnit: 'psi'
  },
  {
    id: 'shortcut-data',
    label: 'Data size',
    detail: 'GB ↔ GiB',
    category: 'data',
    inputUnit: 'gigabyte',
    outputUnit: 'gibibyte'
  }
];

const UNIT_DEFINITIONS: UnitDefinition[] = [
  // Length & Distance
  {
    id: 'meter',
    label: 'Meter',
    symbol: 'm',
    type: 'length',
    toBase: (value) => value,
    fromBase: (value) => value,
    precision: 6
  },
  {
    id: 'kilometer',
    label: 'Kilometer',
    symbol: 'km',
    type: 'length',
    toBase: (value) => value * 1000,
    fromBase: (value) => value / 1000
  },
  {
    id: 'centimeter',
    label: 'Centimeter',
    symbol: 'cm',
    type: 'length',
    toBase: (value) => value / 100,
    fromBase: (value) => value * 100
  },
  {
    id: 'millimeter',
    label: 'Millimeter',
    symbol: 'mm',
    type: 'length',
    toBase: (value) => value / 1000,
    fromBase: (value) => value * 1000
  },
  {
    id: 'mile',
    label: 'Mile',
    symbol: 'mi',
    type: 'length',
    toBase: (value) => value * 1609.344,
    fromBase: (value) => value / 1609.344
  },
  {
    id: 'yard',
    label: 'Yard',
    symbol: 'yd',
    type: 'length',
    toBase: (value) => value * 0.9144,
    fromBase: (value) => value / 0.9144
  },
  {
    id: 'foot',
    label: 'Foot',
    symbol: 'ft',
    type: 'length',
    toBase: (value) => value * 0.3048,
    fromBase: (value) => value / 0.3048
  },
  {
    id: 'inch',
    label: 'Inch',
    symbol: 'in',
    type: 'length',
    toBase: (value) => value * 0.0254,
    fromBase: (value) => value / 0.0254
  },
  {
    id: 'lightYear',
    label: 'Light-year',
    symbol: 'ly',
    type: 'length',
    toBase: (value) => value * 9.4607e15,
    fromBase: (value) => value / 9.4607e15,
    precision: 12
  },
  {
    id: 'astronomicalUnit',
    label: 'Astronomical Unit',
    symbol: 'AU',
    type: 'length',
    toBase: (value) => value * 1.495978707e11,
    fromBase: (value) => value / 1.495978707e11,
    precision: 10
  },
  {
    id: 'nanometer',
    label: 'Nanometer',
    symbol: 'nm',
    type: 'length',
    toBase: (value) => value / 1e9,
    fromBase: (value) => value * 1e9
  },

  // Area
  {
    id: 'squareMeter',
    label: 'Square meter',
    symbol: 'm²',
    type: 'area',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'squareKilometer',
    label: 'Square kilometer',
    symbol: 'km²',
    type: 'area',
    toBase: (value) => value * 1_000_000,
    fromBase: (value) => value / 1_000_000
  },
  {
    id: 'squareCentimeter',
    label: 'Square centimeter',
    symbol: 'cm²',
    type: 'area',
    toBase: (value) => value / 10_000,
    fromBase: (value) => value * 10_000
  },
  {
    id: 'squareFoot',
    label: 'Square foot',
    symbol: 'ft²',
    type: 'area',
    toBase: (value) => value * 0.09290304,
    fromBase: (value) => value / 0.09290304
  },
  {
    id: 'squareInch',
    label: 'Square inch',
    symbol: 'in²',
    type: 'area',
    toBase: (value) => value * 0.00064516,
    fromBase: (value) => value / 0.00064516
  },
  {
    id: 'acre',
    label: 'Acre',
    symbol: 'ac',
    type: 'area',
    toBase: (value) => value * 4046.8564224,
    fromBase: (value) => value / 4046.8564224,
    precision: 6
  },
  {
    id: 'hectare',
    label: 'Hectare',
    symbol: 'ha',
    type: 'area',
    toBase: (value) => value * 10_000,
    fromBase: (value) => value / 10_000
  },

  // Temperature (Kelvin base)
  {
    id: 'celsius',
    label: 'Celsius',
    symbol: '°C',
    type: 'temperature',
    toBase: (value) => value + 273.15,
    fromBase: (value) => value - 273.15,
    precision: 4
  },
  {
    id: 'fahrenheit',
    label: 'Fahrenheit',
    symbol: '°F',
    type: 'temperature',
    toBase: (value) => ((value - 32) * 5) / 9 + 273.15,
    fromBase: (value) => ((value - 273.15) * 9) / 5 + 32,
    precision: 4
  },
  {
    id: 'kelvin',
    label: 'Kelvin',
    symbol: 'K',
    type: 'temperature',
    toBase: (value) => value,
    fromBase: (value) => value,
    precision: 4
  },
  {
    id: 'rankine',
    label: 'Rankine',
    symbol: '°R',
    type: 'temperature',
    toBase: (value) => value * (5 / 9),
    fromBase: (value) => value * (9 / 5),
    precision: 4
  },

  // Weight & Mass
  {
    id: 'kilogram',
    label: 'Kilogram',
    symbol: 'kg',
    type: 'weight',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'gram',
    label: 'Gram',
    symbol: 'g',
    type: 'weight',
    toBase: (value) => value / 1000,
    fromBase: (value) => value * 1000
  },
  {
    id: 'pound',
    label: 'Pound',
    symbol: 'lb',
    type: 'weight',
    toBase: (value) => value * 0.45359237,
    fromBase: (value) => value / 0.45359237
  },
  {
    id: 'ounce',
    label: 'Ounce',
    symbol: 'oz',
    type: 'weight',
    toBase: (value) => value * 0.028349523125,
    fromBase: (value) => value / 0.028349523125
  },
  {
    id: 'tonne',
    label: 'Metric Tonne',
    symbol: 't',
    type: 'weight',
    toBase: (value) => value * 1000,
    fromBase: (value) => value / 1000
  },
  {
    id: 'stone',
    label: 'Stone',
    symbol: 'st',
    type: 'weight',
    toBase: (value) => value * 6.35029318,
    fromBase: (value) => value / 6.35029318
  },

  // Volume & Capacity
  {
    id: 'liter',
    label: 'Liter',
    symbol: 'L',
    type: 'volume',
    toBase: (value) => value / 1000,
    fromBase: (value) => value * 1000
  },
  {
    id: 'milliliter',
    label: 'Milliliter',
    symbol: 'mL',
    type: 'volume',
    toBase: (value) => value / 1e6,
    fromBase: (value) => value * 1e6
  },
  {
    id: 'cubicMeter',
    label: 'Cubic Meter',
    symbol: 'm³',
    type: 'volume',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'gallonUS',
    label: 'Gallon (US)',
    symbol: 'gal (US)',
    type: 'volume',
    toBase: (value) => value * 0.003785411784,
    fromBase: (value) => value / 0.003785411784
  },
  {
    id: 'gallonUK',
    label: 'Gallon (UK)',
    symbol: 'gal (UK)',
    type: 'volume',
    toBase: (value) => value * 0.00454609,
    fromBase: (value) => value / 0.00454609
  },
  {
    id: 'cubicFoot',
    label: 'Cubic Foot',
    symbol: 'ft³',
    type: 'volume',
    toBase: (value) => value * 0.028316846592,
    fromBase: (value) => value / 0.028316846592
  },

  // Time
  {
    id: 'second',
    label: 'Second',
    symbol: 's',
    type: 'time',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'millisecond',
    label: 'Millisecond',
    symbol: 'ms',
    type: 'time',
    toBase: (value) => value / 1000,
    fromBase: (value) => value * 1000
  },
  {
    id: 'minute',
    label: 'Minute',
    symbol: 'min',
    type: 'time',
    toBase: (value) => value * 60,
    fromBase: (value) => value / 60
  },
  {
    id: 'hour',
    label: 'Hour',
    symbol: 'h',
    type: 'time',
    toBase: (value) => value * 3600,
    fromBase: (value) => value / 3600
  },
  {
    id: 'day',
    label: 'Day',
    symbol: 'd',
    type: 'time',
    toBase: (value) => value * 86400,
    fromBase: (value) => value / 86400
  },
  {
    id: 'week',
    label: 'Week',
    symbol: 'wk',
    type: 'time',
    toBase: (value) => value * 604800,
    fromBase: (value) => value / 604800
  },
  {
    id: 'year',
    label: 'Year (365 days)',
    symbol: 'y',
    type: 'time',
    toBase: (value) => value * 31536000,
    fromBase: (value) => value / 31536000
  },

  // Speed & Velocity
  {
    id: 'meterPerSecond',
    label: 'Meter per second',
    symbol: 'm/s',
    type: 'speed',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'kilometerPerHour',
    label: 'Kilometer per hour',
    symbol: 'km/h',
    type: 'speed',
    toBase: (value) => value / 3.6,
    fromBase: (value) => value * 3.6
  },
  {
    id: 'milePerHour',
    label: 'Mile per hour',
    symbol: 'mph',
    type: 'speed',
    toBase: (value) => value * 0.44704,
    fromBase: (value) => value / 0.44704
  },
  {
    id: 'knot',
    label: 'Knot',
    symbol: 'kn',
    type: 'speed',
    toBase: (value) => value * 0.514444,
    fromBase: (value) => value / 0.514444
  },
  {
    id: 'mach',
    label: 'Mach (sea level)',
    symbol: 'M',
    type: 'speed',
    toBase: (value) => value * 340.29,
    fromBase: (value) => value / 340.29,
    notes: 'Standard atmosphere, sea level',
    precision: 6
  },

  // Acceleration
  {
    id: 'meterPerSecondSquared',
    label: 'Meter per second squared',
    symbol: 'm/s²',
    type: 'acceleration',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'footPerSecondSquared',
    label: 'Foot per second squared',
    symbol: 'ft/s²',
    type: 'acceleration',
    toBase: (value) => value * 0.3048,
    fromBase: (value) => value / 0.3048
  },
  {
    id: 'gal',
    label: 'Gal',
    symbol: 'Gal',
    type: 'acceleration',
    toBase: (value) => value * 0.01,
    fromBase: (value) => value / 0.01
  },
  {
    id: 'gForce',
    label: 'Standard gravity (g-force)',
    symbol: 'g₀',
    type: 'acceleration',
    toBase: (value) => value * 9.80665,
    fromBase: (value) => value / 9.80665,
    precision: 6
  },

  // Energy
  {
    id: 'joule',
    label: 'Joule',
    symbol: 'J',
    type: 'energy',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'kilojoule',
    label: 'Kilojoule',
    symbol: 'kJ',
    type: 'energy',
    toBase: (value) => value * 1000,
    fromBase: (value) => value / 1000
  },
  {
    id: 'calorie',
    label: 'Calorie',
    symbol: 'cal',
    type: 'energy',
    toBase: (value) => value * 4.184,
    fromBase: (value) => value / 4.184
  },
  {
    id: 'kilocalorie',
    label: 'Kilocalorie',
    symbol: 'kcal',
    type: 'energy',
    toBase: (value) => value * 4184,
    fromBase: (value) => value / 4184
  },
  {
    id: 'kilowattHour',
    label: 'Kilowatt-hour',
    symbol: 'kWh',
    type: 'energy',
    toBase: (value) => value * 3.6e6,
    fromBase: (value) => value / 3.6e6,
    precision: 6
  },
  {
    id: 'btu',
    label: 'BTU (IT)',
    symbol: 'BTU',
    type: 'energy',
    toBase: (value) => value * 1055.05585262,
    fromBase: (value) => value / 1055.05585262,
    precision: 6
  },

  // Power
  {
    id: 'watt',
    label: 'Watt',
    symbol: 'W',
    type: 'power',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'kilowatt',
    label: 'Kilowatt',
    symbol: 'kW',
    type: 'power',
    toBase: (value) => value * 1000,
    fromBase: (value) => value / 1000
  },
  {
    id: 'horsepower',
    label: 'Horsepower (mechanical)',
    symbol: 'hp',
    type: 'power',
    toBase: (value) => value * 745.69987158227,
    fromBase: (value) => value / 745.69987158227,
    precision: 6
  },
  {
    id: 'btuPerHour',
    label: 'BTU per hour',
    symbol: 'BTU/h',
    type: 'power',
    toBase: (value) => value * 0.29307107,
    fromBase: (value) => value / 0.29307107
  },

  // Force
  {
    id: 'newton',
    label: 'Newton',
    symbol: 'N',
    type: 'force',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'kilonewton',
    label: 'Kilonewton',
    symbol: 'kN',
    type: 'force',
    toBase: (value) => value * 1000,
    fromBase: (value) => value / 1000
  },
  {
    id: 'poundForce',
    label: 'Pound-force',
    symbol: 'lbf',
    type: 'force',
    toBase: (value) => value * 4.4482216152605,
    fromBase: (value) => value / 4.4482216152605,
    precision: 6
  },
  {
    id: 'kilogramForce',
    label: 'Kilogram-force',
    symbol: 'kgf',
    type: 'force',
    toBase: (value) => value * 9.80665,
    fromBase: (value) => value / 9.80665
  },
  {
    id: 'dyne',
    label: 'Dyne',
    symbol: 'dyn',
    type: 'force',
    toBase: (value) => value * 1e-5,
    fromBase: (value) => value / 1e-5
  },

  // Pressure
  {
    id: 'pascal',
    label: 'Pascal',
    symbol: 'Pa',
    type: 'pressure',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'kilopascal',
    label: 'Kilopascal',
    symbol: 'kPa',
    type: 'pressure',
    toBase: (value) => value * 1000,
    fromBase: (value) => value / 1000
  },
  {
    id: 'bar',
    label: 'Bar',
    symbol: 'bar',
    type: 'pressure',
    toBase: (value) => value * 1e5,
    fromBase: (value) => value / 1e5
  },
  {
    id: 'psi',
    label: 'Pound per square inch',
    symbol: 'psi',
    type: 'pressure',
    toBase: (value) => value * 6894.757293168,
    fromBase: (value) => value / 6894.757293168
  },
  {
    id: 'atmosphere',
    label: 'Standard atmosphere',
    symbol: 'atm',
    type: 'pressure',
    toBase: (value) => value * 101325,
    fromBase: (value) => value / 101325
  },

  // Density
  {
    id: 'kilogramPerCubicMeter',
    label: 'Kilogram per cubic meter',
    symbol: 'kg/m³',
    type: 'density',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'gramPerCubicCentimeter',
    label: 'Gram per cubic centimeter',
    symbol: 'g/cm³',
    type: 'density',
    toBase: (value) => value * 1000,
    fromBase: (value) => value / 1000
  },
  {
    id: 'poundPerCubicFoot',
    label: 'Pound per cubic foot',
    symbol: 'lb/ft³',
    type: 'density',
    toBase: (value) => value * 16.01846337396,
    fromBase: (value) => value / 16.01846337396
  },
  {
    id: 'poundPerGallonUS',
    label: 'Pound per gallon (US)',
    symbol: 'lb/gal (US)',
    type: 'density',
    toBase: (value) => value * 119.8264273,
    fromBase: (value) => value / 119.8264273
  },

  // Torque
  {
    id: 'newtonMeter',
    label: 'Newton meter',
    symbol: 'N·m',
    type: 'torque',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'poundFoot',
    label: 'Pound-foot',
    symbol: 'lb·ft',
    type: 'torque',
    toBase: (value) => value * 1.3558179483314,
    fromBase: (value) => value / 1.3558179483314
  },
  {
    id: 'kilogramCentimeter',
    label: 'Kilogram centimeter',
    symbol: 'kg·cm',
    type: 'torque',
    toBase: (value) => value * 0.0980665,
    fromBase: (value) => value / 0.0980665
  },
  {
    id: 'dyneCentimeter',
    label: 'Dyne centimeter',
    symbol: 'dyn·cm',
    type: 'torque',
    toBase: (value) => value * 1e-5,
    fromBase: (value) => value / 1e-5
  },

  // Flow rate
  {
    id: 'cubicMeterPerSecond',
    label: 'Cubic meter per second',
    symbol: 'm³/s',
    type: 'flowRate',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'literPerMinute',
    label: 'Liter per minute',
    symbol: 'L/min',
    type: 'flowRate',
    toBase: (value) => value / 60000,
    fromBase: (value) => value * 60000
  },
  {
    id: 'gallonPerMinute',
    label: 'Gallon per minute (US)',
    symbol: 'gal/min',
    type: 'flowRate',
    toBase: (value) => (value * 0.003785411784) / 60,
    fromBase: (value) => (value * 60) / 0.003785411784
  },
  {
    id: 'cubicFootPerSecond',
    label: 'Cubic foot per second',
    symbol: 'ft³/s',
    type: 'flowRate',
    toBase: (value) => value * 0.028316846592,
    fromBase: (value) => value / 0.028316846592
  },

  // Frequency
  {
    id: 'hertz',
    label: 'Hertz',
    symbol: 'Hz',
    type: 'frequency',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'kilohertz',
    label: 'Kilohertz',
    symbol: 'kHz',
    type: 'frequency',
    toBase: (value) => value * 1_000,
    fromBase: (value) => value / 1_000
  },
  {
    id: 'megahertz',
    label: 'Megahertz',
    symbol: 'MHz',
    type: 'frequency',
    toBase: (value) => value * 1_000_000,
    fromBase: (value) => value / 1_000_000
  },
  {
    id: 'gigahertz',
    label: 'Gigahertz',
    symbol: 'GHz',
    type: 'frequency',
    toBase: (value) => value * 1_000_000_000,
    fromBase: (value) => value / 1_000_000_000
  },
  {
    id: 'revolutionsPerMinute',
    label: 'Revolutions per minute',
    symbol: 'rpm',
    type: 'frequency',
    toBase: (value) => value / 60,
    fromBase: (value) => value * 60
  },

  // Angle
  {
    id: 'radian',
    label: 'Radian',
    symbol: 'rad',
    type: 'angle',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'degree',
    label: 'Degree',
    symbol: '°',
    type: 'angle',
    toBase: (value) => (value * Math.PI) / 180,
    fromBase: (value) => (value * 180) / Math.PI,
    precision: 8
  },
  {
    id: 'gradian',
    label: 'Gradian',
    symbol: 'gon',
    type: 'angle',
    toBase: (value) => (value * Math.PI) / 200,
    fromBase: (value) => (value * 200) / Math.PI
  },
  {
    id: 'arcMinute',
    label: 'Arcminute',
    symbol: '′',
    type: 'angle',
    toBase: (value) => (value * Math.PI) / 10_800,
    fromBase: (value) => (value * 10_800) / Math.PI,
    precision: 8
  },
  {
    id: 'arcSecond',
    label: 'Arcsecond',
    symbol: '″',
    type: 'angle',
    toBase: (value) => (value * Math.PI) / 648_000,
    fromBase: (value) => (value * 648_000) / Math.PI,
    precision: 8
  },

  // Illuminance
  {
    id: 'lux',
    label: 'Lux',
    symbol: 'lx',
    type: 'illuminance',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'footCandle',
    label: 'Foot-candle',
    symbol: 'fc',
    type: 'illuminance',
    toBase: (value) => value * 10.76391041671,
    fromBase: (value) => value / 10.76391041671,
    precision: 6
  },
  {
    id: 'phot',
    label: 'Phot',
    symbol: 'ph',
    type: 'illuminance',
    toBase: (value) => value * 10_000,
    fromBase: (value) => value / 10_000
  },
  {
    id: 'lumenPerSquareFoot',
    label: 'Lumen per square foot',
    symbol: 'lm/ft²',
    type: 'illuminance',
    toBase: (value) => value * 10.76391041671,
    fromBase: (value) => value / 10.76391041671
  },

  // Luminance
  {
    id: 'candelaPerSquareMeter',
    label: 'Candela per square meter',
    symbol: 'cd/m²',
    type: 'luminance',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'nit',
    label: 'Nit',
    symbol: 'nt',
    type: 'luminance',
    toBase: (value) => value,
    fromBase: (value) => value,
    notes: '1 nit = 1 cd/m²'
  },
  {
    id: 'footLambert',
    label: 'Foot-lambert',
    symbol: 'fL',
    type: 'luminance',
    toBase: (value) => value * 3.4262590996,
    fromBase: (value) => value / 3.4262590996,
    precision: 6
  },
  {
    id: 'candelaPerSquareFoot',
    label: 'Candela per square foot',
    symbol: 'cd/ft²',
    type: 'luminance',
    toBase: (value) => value * 10.76391041671,
    fromBase: (value) => value / 10.76391041671
  },

  // Radiation (dose & activity groups)
  {
    id: 'gray',
    label: 'Gray',
    symbol: 'Gy',
    type: 'radiation',
    dimension: 'dose',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'sievert',
    label: 'Sievert',
    symbol: 'Sv',
    type: 'radiation',
    dimension: 'dose',
    toBase: (value) => value,
    fromBase: (value) => value,
    notes: 'Assumes quality factor of 1'
  },
  {
    id: 'rad',
    label: 'Rad',
    symbol: 'rad',
    type: 'radiation',
    dimension: 'dose',
    toBase: (value) => value * 0.01,
    fromBase: (value) => value / 0.01
  },
  {
    id: 'roentgen',
    label: 'Roentgen',
    symbol: 'R',
    type: 'radiation',
    dimension: 'exposure',
    toBase: (value) => value,
    fromBase: (value) => value,
    notes: 'Exposure in air; conversions require medium assumptions'
  },
  {
    id: 'becquerel',
    label: 'Becquerel',
    symbol: 'Bq',
    type: 'radiation',
    dimension: 'activity',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'curie',
    label: 'Curie',
    symbol: 'Ci',
    type: 'radiation',
    dimension: 'activity',
    toBase: (value) => value * 3.7e10,
    fromBase: (value) => value / 3.7e10,
    precision: 6
  },

  // Magnetic field
  {
    id: 'tesla',
    label: 'Tesla',
    symbol: 'T',
    type: 'magneticField',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'gauss',
    label: 'Gauss',
    symbol: 'G',
    type: 'magneticField',
    toBase: (value) => value / 10_000,
    fromBase: (value) => value * 10_000
  },
  {
    id: 'weberPerSquareMeter',
    label: 'Weber per square meter',
    symbol: 'Wb/m²',
    type: 'magneticField',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'ampereTurnPerMeter',
    label: 'Ampere-turn per meter',
    symbol: 'At/m',
    type: 'magneticField',
    toBase: (value) => value * (4 * Math.PI * 1e-7),
    fromBase: (value) => value / (4 * Math.PI * 1e-7),
    notes: 'Assumes linear medium, μ₀ = 4π × 10⁻⁷ H/m'
  },

  // Capacitance
  {
    id: 'farad',
    label: 'Farad',
    symbol: 'F',
    type: 'capacitance',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'millifarad',
    label: 'Millifarad',
    symbol: 'mF',
    type: 'capacitance',
    toBase: (value) => value / 1_000,
    fromBase: (value) => value * 1_000
  },
  {
    id: 'microfarad',
    label: 'Microfarad',
    symbol: 'µF',
    type: 'capacitance',
    toBase: (value) => value / 1_000_000,
    fromBase: (value) => value * 1_000_000
  },
  {
    id: 'nanofarad',
    label: 'Nanofarad',
    symbol: 'nF',
    type: 'capacitance',
    toBase: (value) => value / 1_000_000_000,
    fromBase: (value) => value * 1_000_000_000
  },
  {
    id: 'picofarad',
    label: 'Picofarad',
    symbol: 'pF',
    type: 'capacitance',
    toBase: (value) => value / 1_000_000_000_000,
    fromBase: (value) => value * 1_000_000_000_000
  },

  // Resistance
  {
    id: 'ohm',
    label: 'Ohm',
    symbol: 'Ω',
    type: 'resistance',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'milliohm',
    label: 'Milliohm',
    symbol: 'mΩ',
    type: 'resistance',
    toBase: (value) => value / 1_000,
    fromBase: (value) => value * 1_000
  },
  {
    id: 'kiloohm',
    label: 'Kiloohm',
    symbol: 'kΩ',
    type: 'resistance',
    toBase: (value) => value * 1_000,
    fromBase: (value) => value / 1_000
  },
  {
    id: 'megaohm',
    label: 'Megaohm',
    symbol: 'MΩ',
    type: 'resistance',
    toBase: (value) => value * 1_000_000,
    fromBase: (value) => value / 1_000_000
  },

  // Inductance
  {
    id: 'henry',
    label: 'Henry',
    symbol: 'H',
    type: 'inductance',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'millihenry',
    label: 'Millihenry',
    symbol: 'mH',
    type: 'inductance',
    toBase: (value) => value / 1_000,
    fromBase: (value) => value * 1_000
  },
  {
    id: 'microhenry',
    label: 'Microhenry',
    symbol: 'µH',
    type: 'inductance',
    toBase: (value) => value / 1_000_000,
    fromBase: (value) => value * 1_000_000
  },
  {
    id: 'nanohenry',
    label: 'Nanohenry',
    symbol: 'nH',
    type: 'inductance',
    toBase: (value) => value / 1_000_000_000,
    fromBase: (value) => value * 1_000_000_000
  },

  // Electric charge
  {
    id: 'coulomb',
    label: 'Coulomb',
    symbol: 'C',
    type: 'electricCharge',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'ampereHour',
    label: 'Ampere-hour',
    symbol: 'Ah',
    type: 'electricCharge',
    toBase: (value) => value * 3600,
    fromBase: (value) => value / 3600
  },
  {
    id: 'milliampereHour',
    label: 'Milliampere-hour',
    symbol: 'mAh',
    type: 'electricCharge',
    toBase: (value) => value * 3.6,
    fromBase: (value) => value / 3.6
  },
  {
    id: 'faraday',
    label: 'Faraday',
    symbol: 'Fₙ',
    type: 'electricCharge',
    toBase: (value) => value * 96485.33212,
    fromBase: (value) => value / 96485.33212,
    precision: 6
  },

  // Electric current
  {
    id: 'ampere',
    label: 'Ampere',
    symbol: 'A',
    type: 'electricCurrent',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'milliampere',
    label: 'Milliampere',
    symbol: 'mA',
    type: 'electricCurrent',
    toBase: (value) => value / 1_000,
    fromBase: (value) => value * 1_000
  },
  {
    id: 'microampere',
    label: 'Microampere',
    symbol: 'µA',
    type: 'electricCurrent',
    toBase: (value) => value / 1_000_000,
    fromBase: (value) => value * 1_000_000
  },
  {
    id: 'kiloampere',
    label: 'Kiloampere',
    symbol: 'kA',
    type: 'electricCurrent',
    toBase: (value) => value * 1_000,
    fromBase: (value) => value / 1_000
  },

  // Electric potential
  {
    id: 'volt',
    label: 'Volt',
    symbol: 'V',
    type: 'electricPotential',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'millivolt',
    label: 'Millivolt',
    symbol: 'mV',
    type: 'electricPotential',
    toBase: (value) => value / 1_000,
    fromBase: (value) => value * 1_000
  },
  {
    id: 'microvolt',
    label: 'Microvolt',
    symbol: 'µV',
    type: 'electricPotential',
    toBase: (value) => value / 1_000_000,
    fromBase: (value) => value * 1_000_000
  },
  {
    id: 'kilovolt',
    label: 'Kilovolt',
    symbol: 'kV',
    type: 'electricPotential',
    toBase: (value) => value * 1_000,
    fromBase: (value) => value / 1_000
  },

  // Conductance
  {
    id: 'siemens',
    label: 'Siemens',
    symbol: 'S',
    type: 'conductance',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'millisiemens',
    label: 'Millisiemens',
    symbol: 'mS',
    type: 'conductance',
    toBase: (value) => value / 1_000,
    fromBase: (value) => value * 1_000
  },
  {
    id: 'microsiemens',
    label: 'Microsiemens',
    symbol: 'µS',
    type: 'conductance',
    toBase: (value) => value / 1_000_000,
    fromBase: (value) => value * 1_000_000
  },
  {
    id: 'mho',
    label: 'Mho',
    symbol: '℧',
    type: 'conductance',
    toBase: (value) => value,
    fromBase: (value) => value,
    notes: 'Alternate name for siemens'
  },

  // Impedance
  {
    id: 'impedanceOhm',
    label: 'Ohm',
    symbol: 'Ω',
    type: 'impedance',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'impedanceMilliohm',
    label: 'Milliohm',
    symbol: 'mΩ',
    type: 'impedance',
    toBase: (value) => value / 1_000,
    fromBase: (value) => value * 1_000
  },
  {
    id: 'impedanceKiloohm',
    label: 'Kiloohm',
    symbol: 'kΩ',
    type: 'impedance',
    toBase: (value) => value * 1_000,
    fromBase: (value) => value / 1_000
  },
  {
    id: 'impedanceMegaohm',
    label: 'Megaohm',
    symbol: 'MΩ',
    type: 'impedance',
    toBase: (value) => value * 1_000_000,
    fromBase: (value) => value / 1_000_000
  },

  // Surface tension
  {
    id: 'newtonPerMeter',
    label: 'Newton per meter',
    symbol: 'N/m',
    type: 'surfaceTension',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'dynePerCentimeter',
    label: 'Dyne per centimeter',
    symbol: 'dyn/cm',
    type: 'surfaceTension',
    toBase: (value) => value / 1_000,
    fromBase: (value) => value * 1_000
  },
  {
    id: 'poundForcePerInch',
    label: 'Pound-force per inch',
    symbol: 'lbf/in',
    type: 'surfaceTension',
    toBase: (value) => value * 175.1268369858,
    fromBase: (value) => value / 175.1268369858,
    precision: 6
  },

  // Data & Storage (base on bytes)
  {
    id: 'bit',
    label: 'Bit',
    symbol: 'b',
    type: 'data',
    toBase: (value) => value / 8,
    fromBase: (value) => value * 8
  },
  {
    id: 'byte',
    label: 'Byte',
    symbol: 'B',
    type: 'data',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'kilobyte',
    label: 'Kilobyte (KB)',
    symbol: 'KB',
    type: 'data',
    toBase: (value) => value * 1000,
    fromBase: (value) => value / 1000
  },
  {
    id: 'megabyte',
    label: 'Megabyte (MB)',
    symbol: 'MB',
    type: 'data',
    toBase: (value) => value * 1e6,
    fromBase: (value) => value / 1e6
  },
  {
    id: 'gigabyte',
    label: 'Gigabyte (GB)',
    symbol: 'GB',
    type: 'data',
    toBase: (value) => value * 1e9,
    fromBase: (value) => value / 1e9
  },
  {
    id: 'terabyte',
    label: 'Terabyte (TB)',
    symbol: 'TB',
    type: 'data',
    toBase: (value) => value * 1e12,
    fromBase: (value) => value / 1e12
  },
  {
    id: 'kibibyte',
    label: 'Kibibyte (KiB)',
    symbol: 'KiB',
    type: 'data',
    toBase: (value) => value * 1024,
    fromBase: (value) => value / 1024
  },
  {
    id: 'mebibyte',
    label: 'Mebibyte (MiB)',
    symbol: 'MiB',
    type: 'data',
    toBase: (value) => value * Math.pow(1024, 2),
    fromBase: (value) => value / Math.pow(1024, 2)
  },
  {
    id: 'gibibyte',
    label: 'Gibibyte (GiB)',
    symbol: 'GiB',
    type: 'data',
    toBase: (value) => value * Math.pow(1024, 3),
    fromBase: (value) => value / Math.pow(1024, 3)
  },

  // Currency (placeholder; external rates needed)
  {
    id: 'usd',
    label: 'US Dollar',
    symbol: 'USD',
    type: 'currency',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'eur',
    label: 'Euro',
    symbol: 'EUR',
    type: 'currency',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'gbp',
    label: 'Pound Sterling',
    symbol: 'GBP',
    type: 'currency',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'jpy',
    label: 'Japanese Yen',
    symbol: 'JPY',
    type: 'currency',
    toBase: (value) => value,
    fromBase: (value) => value
  },
  {
    id: 'inr',
    label: 'Indian Rupee',
    symbol: 'INR',
    type: 'currency',
    toBase: (value) => value,
    fromBase: (value) => value
  }
];

const UNIT_INDEXES: Record<string, UnitDefinition> = UNIT_DEFINITIONS.reduce(
  (acc, unit) => ({ ...acc, [unit.id]: unit }),
  {} as Record<string, UnitDefinition>
);

class ConversionEngine {
  constructor(private readonly units: Record<string, UnitDefinition>) {}

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
    const precision = toUnit.precision ?? Math.min(BASE_PRECISION, 8);

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

class ConversionHistoryStore {
  private readonly maxEntries: number;
  private readonly entries: WritableSignal<ConversionResult[]>;

  constructor(limit = 25) {
    this.maxEntries = limit;
    this.entries = signal<ConversionResult[]>([]);
  }

  push(result: ConversionResult): void {
    this.entries.update((current) => {
      const next = [result, ...current.filter((entry) => !(entry.inputValue === result.inputValue && entry.inputUnit.id === result.inputUnit.id && entry.outputUnit.id === result.outputUnit.id))];
      return next.slice(0, this.maxEntries);
    });
  }

  all(): Signal<ConversionResult[]> {
    return this.entries.asReadonly();
  }
}

class PresetStore {
  private readonly entries: WritableSignal<ConversionPreset[]>;

  constructor(initial: ConversionPreset[] = []) {
    this.entries = signal(initial);
  }

  add(preset: Omit<ConversionPreset, 'id' | 'createdAt'>): void {
    const id = crypto.randomUUID();
    const createdAt = Date.now();

    this.entries.update((current) => [{ ...preset, id, createdAt }, ...current]);
  }

  remove(id: string): void {
    this.entries.update((current) => current.filter((preset) => preset.id !== id));
  }

  all(): Signal<ConversionPreset[]> {
    return this.entries.asReadonly();
  }
}

class CurrencyRateService {
  private readonly cache = new Map<string, { expires: number; rates: Record<string, number> }>();

  constructor(private readonly providers: ExternalRateProvider[]) {}

  getRates(providerId: string): Observable<Record<string, number>> {
    const provider = this.providers.find((p) => p.id === providerId);
    if (!provider) {
      return of({});
    }

    const cached = this.cache.get(provider.id);
    if (cached && cached.expires > Date.now()) {
      return of(cached.rates);
    }

    return provider.fetchRates().pipe(
      tap((rates) => this.cache.set(provider.id, { rates, expires: Date.now() + provider.ttl })),
      shareReplay(1)
    );
  }
}

@Component({
  selector: 'lib-unit-converter',
  standalone: true,
  templateUrl: './unit-converter.html',
  styleUrls: ['./unit-converter.scss'],
  imports: [CommonModule, ReactiveFormsModule, Navigation]
})
export class UnitConverterComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly engine = new ConversionEngine(UNIT_INDEXES);
  private readonly historyStore = new ConversionHistoryStore();
  private readonly presetStore = new PresetStore([
    { id: 'default-length', name: 'Meters to Feet', category: 'length', inputUnit: 'meter', outputUnit: 'foot', createdAt: Date.now() - 7200000 },
    { id: 'default-temp', name: 'Celsius to Fahrenheit', category: 'temperature', inputUnit: 'celsius', outputUnit: 'fahrenheit', createdAt: Date.now() - 14400000 }
  ]);
  private readonly currencyService = new CurrencyRateService([
    {
      id: 'mockRates',
      label: 'Mock FX Provider',
      ttl: 1000 * 60 * 15,
      fetchRates: () =>
        of({
          usd: 1,
          eur: 0.92,
          gbp: 0.79,
          jpy: 150.35,
          inr: 83.14,
          aud: 1.54
        }).pipe(delayIfDev())
    }
  ]);
  private readonly defaultRateProvider = 'mockRates';

  readonly categories = CATEGORY_DEFINITIONS;
  readonly unitsByType: Record<UnitType, UnitDefinition[]> = UNIT_DEFINITIONS.reduce(
    (acc, unit) => ({
      ...acc,
      [unit.type]: [...(acc[unit.type] ?? []), unit]
    }),
    {} as Record<UnitType, UnitDefinition[]>
  );

  readonly searchTerm = signal('');
  readonly selectedCategory = signal<UnitType>('length');

  readonly conversionForm = this.fb.group({
    inputValue: this.fb.control(1, { nonNullable: true, validators: [Validators.required] }),
    inputUnit: this.fb.control('meter', { nonNullable: true }),
    outputUnit: this.fb.control('foot', { nonNullable: true })
  });

  readonly conversionResult: WritableSignal<ConversionResult | null> = signal(null);
  readonly conversionError: WritableSignal<string | null> = signal(null);
  readonly isConverting = signal(false);
  readonly history = this.historyStore.all();
  readonly presets = this.presetStore.all();
  readonly statusMessage = signal<string | null>(null);
  readonly quickShortcuts = QUICK_SHORTCUTS;

  readonly totalUnitCount = UNIT_DEFINITIONS.length;
  readonly totalCategoryCount = CATEGORY_DEFINITIONS.length;

  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly conversionSubscription: Subscription;

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

  readonly filteredCategories: Signal<CategoryDefinition[]> = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return CATEGORY_DEFINITIONS;
    }

    return CATEGORY_DEFINITIONS.filter((category) => {
      const matchesTitle = category.title.toLowerCase().includes(term);
      const matchesDescription = category.description.toLowerCase().includes(term);
      const matchesFeatured = category.featuredUnits.some((unitId) => UNIT_INDEXES[unitId]?.label.toLowerCase().includes(term));
      return matchesTitle || matchesDescription || matchesFeatured;
    });
  });

  readonly quickPresetChips = computed(() => {
    const presets = this.presets();
    return presets.slice(0, 4);
  });

  readonly historyEntries = computed(() => this.history());
  readonly historyCount = computed(() => this.historyEntries().length);
  readonly presetCount = computed(() => this.presets().length);

  readonly formattedOutputValue = computed(() => {
    const result = this.conversionResult();
    if (!result) {
      return '';
    }

    return this.formatNumber(result.outputValue, result.precision ?? 6);
  });

  readonly conversionSummary = computed(() => {
    const result = this.conversionResult();
    if (!result) {
      return null;
    }

    const inputUnitLabel = result.inputUnit.symbol ?? result.inputUnit.label;
    const outputUnitLabel = result.outputUnit.symbol ?? result.outputUnit.label;
    return `${this.formatNumber(result.inputValue, result.precision ?? 6)} ${inputUnitLabel} = ${this.formatNumber(result.outputValue, result.precision ?? 6)} ${outputUnitLabel}`;
  });

  readonly conversion$ = this.conversionForm.valueChanges.pipe(
    debounceTime(120),
    distinctUntilChanged((prev, curr) => JSON.stringify(prev) === JSON.stringify(curr)),
    switchMap((value) => {
      const inputValue = Number(value.inputValue ?? 0);
      const inputUnit = value.inputUnit ?? BASE_UNITS[this.selectedCategory()];
      const outputUnit = value.outputUnit ?? BASE_UNITS[this.selectedCategory()];

      return this.performConversion(inputValue, inputUnit, outputUnit).pipe(
        catchError((error: unknown) => {
          this.conversionError.set(error instanceof Error ? error.message : 'Conversion failed.');
          return of(null);
        })
      );
    }),
    startWith(null as ConversionResult | null)
  );

  readonly liveRates$: Observable<Record<string, number>> = of({}).pipe(startWith({}));

  readonly trackCategory = (_: number, category: CategoryDefinition) => category.id;
  readonly trackUnit = (_: number, unit: UnitDefinition) => unit.id;
  readonly trackPreset = (_: number, preset: ConversionPreset) => preset.id;
  readonly trackHistory = (_: number, result: ConversionResult) => `${result.inputUnit.id}-${result.outputUnit.id}-${result.timestamp}`;
  readonly trackShortcut = (_: number, shortcut: QuickConversionShortcut) => shortcut.id;

  private readonly uiEffects = [
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
    })
  ];

  constructor() {
    this.conversionSubscription = this.conversion$.subscribe({
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
        this.conversionError.set(error instanceof Error ? error.message : 'Conversion failed.');
      }
    });
  }

  ngOnDestroy(): void {
    this.clearStatusTimer();
    this.conversionSubscription.unsubscribe();
  }

  onCategorySearch(term: string): void {
    this.searchTerm.set(term.trim());
  }

  onConversionSubmit(): void {
    this.convertNow();
  }

  focusInputField(): void {
    this.inputField?.nativeElement.focus();
    this.notify('Enter a value to start converting.');
  }

  viewHistory(): void {
    if (this.historySection?.nativeElement) {
      this.historySection.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    this.notify('Showing your recent conversions.');
  }

  manageHistory(): void {
    this.notify('History management tools are coming soon.');
  }

  customizeQuickActions(): void {
    this.notify('Quick conversion customization is on the roadmap.');
  }

  inviteCollaborators(): void {
    this.notify('Collaboration invites will be available in a future update.');
  }

  promptSavePreset(): void {
    const defaultName = `${this.selectedCategoryDetails().title} preset`;
    const promptHost = globalThis as { prompt?: PromptFn };
    const promptValue = promptHost.prompt?.('Save the current setup as a preset.', defaultName) ?? defaultName;

    if (promptValue?.trim().length) {
      this.savePreset(promptValue.trim());
      this.notify('Preset saved.');
    }
  }

  onPresetChipClick(preset: ConversionPreset): void {
    this.applyPreset(preset);
    this.notify(`Preset "${preset.name}" applied.`);
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
    this.notify(`${shortcut.label} shortcut ready.`);
  }

  formatUnitLabel(unit: UnitDefinition): string {
    const symbol = unit.symbol ?? unit.id;
    return unit.symbol ? `${unit.label} (${symbol})` : unit.label;
  }

  formatHistoryMeta(result: ConversionResult): string {
    const elapsedMs = Date.now() - result.timestamp;
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

  formatNumber(value: number, precision = 6): string {
    if (!Number.isFinite(value)) {
      return '—';
    }

    const safePrecision = Math.min(Math.max(0, precision), 12);
    return value.toLocaleString(undefined, {
      maximumFractionDigits: safePrecision
    });
  }

  notify(message: string): void {
    this.statusMessage.set(message);
    this.clearStatusTimer();
    this.statusTimer = setTimeout(() => this.statusMessage.set(null), 4000);
  }

  private clearStatusTimer(): void {
    if (this.statusTimer) {
      clearTimeout(this.statusTimer);
      this.statusTimer = null;
    }
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
        this.notify(`${categoryDefinition.title} converter ready.`);
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

    this.notify('Units swapped.');
  }

  convertNow(): void {
    const { inputValue, inputUnit, outputUnit } = this.conversionForm.value;

    this.performConversion(Number(inputValue ?? 0), inputUnit ?? '', outputUnit ?? '')
      .pipe(
        catchError((error: unknown) => {
          this.conversionError.set(error instanceof Error ? error.message : 'Conversion failed.');
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
          this.notify('Conversion updated.');
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

  private performConversion(value: number, fromUnitId: string, toUnitId: string): Observable<ConversionResult> {
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

  private convertCurrency(value: number, fromUnit: UnitDefinition, toUnit: UnitDefinition): Observable<ConversionResult> {
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

function delayIfDev<T>() {
  return (source: Observable<T>) => source.pipe(tap(() => {}));
}
