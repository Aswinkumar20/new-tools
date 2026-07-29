import type { UnitDefinition } from '../types/unit-converter.types';

export const UNIT_DEFINITIONS: ReadonlyArray<UnitDefinition> = [
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
]

export const UNIT_INDEXES: Readonly<Record<string, UnitDefinition>> = UNIT_DEFINITIONS.reduce(
  (acc, unit) => {
    acc[unit.id] = unit;
    return acc;
  },
  {} as Record<string, UnitDefinition>
);

export const UNITS_BY_TYPE: Readonly<Record<string, UnitDefinition[]>> = UNIT_DEFINITIONS.reduce(
  (acc, unit) => {
    const list = acc[unit.type] ?? [];
    list.push(unit);
    acc[unit.type] = list;
    return acc;
  },
  {} as Record<string, UnitDefinition[]>
);
