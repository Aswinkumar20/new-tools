/**
 * Ambient module declaration for ical.js when resolved via vendor path mapping.
 * Full typings ship with the package under dist/types once installed in node_modules.
 */
declare module 'ical.js' {
  export class Component {
    name: string;
    constructor(jCal: unknown, parent?: Component | null);
    getFirstPropertyValue(name: string): unknown;
    getFirstProperty(name: string): Property | null;
    getAllProperties(name?: string): Property[];
    getAllSubcomponents(name?: string): Component[];
  }

  export class Property {
    getFirstValue(): unknown;
    getValues(): unknown[];
    getParameter(name: string): unknown;
  }

  export class Time {
    isDate: boolean;
    zone?: { tzid?: string };
    clone(): Time;
    addDuration(duration: Duration): void;
    toJSDate(): Date;
    toString(): string;
  }

  export class Duration {
    toString(): string;
  }

  export class Event {
    constructor(component: Component);
    uid: string;
    summary: string;
    description?: string;
    location?: string;
    status?: string;
    startDate: Time;
    endDate?: Time;
    duration?: Duration;
    isRecurring(): boolean;
  }

  export class RecurExpansion {
    complete: boolean;
    constructor(options: { component: Component; dtstart: Time });
    next(): Time | null;
  }

  export function parse(input: string): unknown;

  const ICAL: {
    Component: typeof Component;
    Property: typeof Property;
    Time: typeof Time;
    Duration: typeof Duration;
    Event: typeof Event;
    RecurExpansion: typeof RecurExpansion;
    parse: typeof parse;
  };

  export default ICAL;
}
