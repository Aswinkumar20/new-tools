import type { MdRelatedToolLink } from '../shared/md-tool-suggestion.model';
import type {
  CategoryDefinition,
  ConversionPreset,
  QuickConversionShortcut,
  UnitType
} from '../types/unit-converter.types';

export const UNIT_CONVERTER_HISTORY_LIMIT = 25;
export const UNIT_CONVERTER_BASE_PRECISION = 12;
export const UNIT_CONVERTER_DEFAULT_CATEGORY: UnitType = 'length';

export const BASE_UNITS: Readonly<Record<UnitType, string>> = {
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
}

export const CATEGORY_DEFINITIONS: ReadonlyArray<CategoryDefinition> = [
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
]

export const QUICK_SHORTCUTS: ReadonlyArray<QuickConversionShortcut> = [
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
]

export const UNIT_CONVERTER_DEFAULT_PRESETS: ReadonlyArray<ConversionPreset> = [
  {
    id: 'default-length',
    name: 'Meters to Feet',
    category: 'length',
    inputUnit: 'meter',
    outputUnit: 'foot',
    createdAt: Date.now() - 7200000
  },
  {
    id: 'default-temp',
    name: 'Celsius to Fahrenheit',
    category: 'temperature',
    inputUnit: 'celsius',
    outputUnit: 'fahrenheit',
    createdAt: Date.now() - 14400000
  }
];

export const UNIT_CONVERTER_RELATED_TOOLS: ReadonlyArray<MdRelatedToolLink> = [
  {
    label: 'Currency Converter',
    path: '/math-date-utils/currency-converter',
    description: 'Live FX rates when converting money instead of static placeholders'
  },
  {
    label: 'Percentage Calculator',
    path: '/math-date-utils/percentage-calculator',
    description: 'Express conversion factors or scale changes as percentages'
  },
  {
    label: 'Number to Words',
    path: '/math-date-utils/number-to-words',
    description: 'Spell out converted values for documents and labels'
  },
  {
    label: 'Fraction Calculator',
    path: '/math-date-utils/fraction-calculator',
    description: 'Work with ratio forms of conversion factors'
  }
];
