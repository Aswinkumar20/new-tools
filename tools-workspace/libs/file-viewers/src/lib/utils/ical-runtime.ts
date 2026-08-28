import * as ICALModule from 'ical.js';

type IcalApi = {
  parse: (input: string) => unknown;
  Component: new (jCal: unknown, parent?: unknown) => IcalComponent;
  Event: new (component: IcalComponent) => IcalEvent;
  RecurExpansion: new (options: { component: IcalComponent; dtstart: unknown }) => {
    complete: boolean;
    next(): unknown;
  };
};

interface IcalComponent {
  name: string;
  getFirstPropertyValue(name: string): unknown;
  getFirstProperty(name: string): unknown;
  getAllProperties(name?: string): unknown[];
  getAllSubcomponents(name?: string): IcalComponent[];
}

interface IcalEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  status?: string;
  startDate: unknown;
  endDate?: unknown;
  duration?: unknown;
  isRecurring(): boolean;
}

function resolveIcal(mod: unknown): IcalApi {
  if (!mod || typeof mod !== 'object') {
    throw new Error('ical.js failed to load');
  }
  const candidate = mod as { default?: IcalApi } & Partial<IcalApi>;
  if (typeof candidate.parse === 'function') {
    return candidate as IcalApi;
  }
  if (candidate.default && typeof candidate.default.parse === 'function') {
    return candidate.default;
  }
  throw new Error('ical.js failed to load');
}

const ICAL = resolveIcal(ICALModule);

export default ICAL;
