import ICAL from './ical-runtime';
import {
  ICS_DEFAULT_EVENT_DURATION_MS,
  ICS_EVENT_COLORS,
  ICS_MAX_RECURRENCE_OCCURRENCES
} from '../constants/ics-viewer.constants';
import type {
  IcsCalendarEvent,
  IcsCalendarMeta,
  IcsParseResult,
  IcsParticipant,
  IcsRecurrenceInfo,
  IcsReminder
} from '../types/ics-viewer.types';

interface IcalProperty {
  getFirstValue(): unknown;
  getValues(): unknown[];
  getParameter(name: string): unknown;
}

interface IcalTime {
  isDate: boolean;
  zone?: { tzid?: string };
  clone(): IcalTime;
  addDuration(duration: unknown): void;
  toJSDate(): Date;
  toString(): string;
}

interface IcalComponent {
  name: string;
  getFirstPropertyValue(name: string): unknown;
  getFirstProperty(name: string): IcalProperty | null;
  getAllProperties(name?: string): IcalProperty[];
  getAllSubcomponents(name?: string): IcalComponent[];
}

interface IcalEvent {
  uid: string;
  summary: string;
  description?: string;
  location?: string;
  status?: string;
  startDate: IcalTime;
  endDate?: IcalTime;
  duration?: unknown;
  isRecurring(): boolean;
}

function icalValueText(value: unknown): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'object' && typeof (value as { toString?: () => string }).toString === 'function') {
    return String((value as { toString: () => string }).toString());
  }
  return String(value);
}

function safeText(value: unknown): string | undefined {
  const text = icalValueText(value).trim();
  return text.length ? text : undefined;
}

function parseCategories(component: IcalComponent): string[] {
  const categories: string[] = [];
  for (const prop of component.getAllProperties('categories')) {
    const values = typeof prop.getValues === 'function' ? prop.getValues() : [prop.getFirstValue()];
    for (const value of values) {
      if (value == null) {
        continue;
      }
      if (Array.isArray(value)) {
        value.forEach((v) => {
          const text = String(v).trim();
          if (text) {
            categories.push(text);
          }
        });
      } else {
        String(value)
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean)
          .forEach((v) => categories.push(v));
      }
    }
  }
  return [...new Set(categories)];
}

function parseMailto(value: string): { name?: string; email?: string; raw: string } {
  const raw = value.trim();
  const emailPart = raw.replace(/^mailto:/i, '');
  if (emailPart.includes('@')) {
    return { email: emailPart, raw };
  }
  return { raw };
}

function readParticipant(property: IcalProperty | null): IcsParticipant | undefined {
  if (!property) {
    return undefined;
  }
  const value = String(property.getFirstValue() ?? '');
  const parsed = parseMailto(value);
  const params = property.getParameter('cn');
  const role = property.getParameter('role');
  const partStat = property.getParameter('partstat');
  const rsvp = property.getParameter('rsvp');
  const cutype = property.getParameter('cutype');
  return {
    name: safeText(Array.isArray(params) ? params[0] : params) ?? parsed.name,
    email: parsed.email,
    role: safeText(Array.isArray(role) ? role[0] : role),
    partStat: safeText(Array.isArray(partStat) ? partStat[0] : partStat),
    rsvp: String(rsvp ?? '').toUpperCase() === 'TRUE',
    cutype: safeText(Array.isArray(cutype) ? cutype[0] : cutype),
    raw: value
  };
}

function readAttendees(component: IcalComponent): IcsParticipant[] {
  return component.getAllProperties('attendee').map((prop) => {
    const participant = readParticipant(prop);
    return (
      participant ?? {
        raw: String(prop.getFirstValue() ?? '')
      }
    );
  });
}

function readReminders(component: IcalComponent): IcsReminder[] {
  return component.getAllSubcomponents('valarm').map((alarm) => {
    const triggerProp = alarm.getFirstProperty('trigger');
    const triggerVal = triggerProp?.getFirstValue();
    let trigger = 'Alarm';
    if (triggerVal && typeof triggerVal === 'object' && 'toString' in triggerVal) {
      trigger = String(triggerVal.toString());
    } else if (triggerVal != null) {
      trigger = String(triggerVal);
    }
    return {
      trigger,
      action: safeText(alarm.getFirstPropertyValue('action')),
      description: safeText(alarm.getFirstPropertyValue('description')),
      summary: safeText(alarm.getFirstPropertyValue('summary'))
    };
  });
}

function summarizeRrule(rrule: string | undefined): string {
  if (!rrule) {
    return 'Does not repeat';
  }
  const upper = rrule.toUpperCase();
  if (upper.includes('FREQ=DAILY')) {
    return 'Repeats daily';
  }
  if (upper.includes('FREQ=WEEKLY')) {
    return 'Repeats weekly';
  }
  if (upper.includes('FREQ=MONTHLY')) {
    return 'Repeats monthly';
  }
  if (upper.includes('FREQ=YEARLY')) {
    return 'Repeats yearly';
  }
  return `Repeats (${rrule})`;
}

function readRecurrence(component: IcalComponent, event: IcalEvent): IcsRecurrenceInfo | undefined {
  if (!event.isRecurring()) {
    return undefined;
  }
  const rruleProp = component.getFirstProperty('rrule');
  const rrule = rruleProp ? icalValueText(rruleProp.getFirstValue()) : undefined;
  const rdates = component.getAllProperties('rdate').map((p) => icalValueText(p.getFirstValue()));
  const exdates = component.getAllProperties('exdate').map((p) => icalValueText(p.getFirstValue()));
  return {
    rrule: rrule || undefined,
    rdates,
    exdates,
    summary: summarizeRrule(rrule)
  };
}

function toJsDate(time: IcalTime | null | undefined, fallback?: Date): Date {
  if (!time) {
    return fallback ? new Date(fallback) : new Date();
  }
  try {
    return time.toJSDate();
  } catch {
    return fallback ? new Date(fallback) : new Date();
  }
}

function isAllDayEvent(event: IcalEvent): boolean {
  return Boolean(event.startDate?.isDate);
}

function endFromEvent(event: IcalEvent, start: Date, allDay: boolean): Date {
  if (event.endDate) {
    const end = toJsDate(event.endDate, start);
    // ICS all-day DTEND is exclusive; keep exclusive end for duration math.
    if (allDay && end.getTime() <= start.getTime()) {
      return new Date(start.getTime() + 24 * 60 * 60 * 1000);
    }
    return end;
  }
  if (event.duration) {
    try {
      const cloned = event.startDate.clone();
      cloned.addDuration(event.duration);
      return toJsDate(cloned, new Date(start.getTime() + ICS_DEFAULT_EVENT_DURATION_MS));
    } catch {
      /* fall through */
    }
  }
  return new Date(start.getTime() + (allDay ? 24 * 60 * 60 * 1000 : ICS_DEFAULT_EVENT_DURATION_MS));
}

function spanDaysFor(start: Date, end: Date, allDay: boolean): number {
  const startDay = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  // Exclusive end for all-day; inclusive last day for timed multi-day.
  const endMs = allDay ? end.getTime() : end.getTime() - 1;
  const endDate = new Date(endMs);
  const endDay = Date.UTC(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.max(1, Math.round((endDay - startDay) / (24 * 60 * 60 * 1000)) + 1);
}

function readCalendarMeta(root: IcalComponent): IcsCalendarMeta {
  return {
    productId: safeText(root.getFirstPropertyValue('prodid')),
    version: safeText(root.getFirstPropertyValue('version')),
    calendarName:
      safeText(root.getFirstPropertyValue('x-wr-calname')) ??
      safeText(root.getFirstPropertyValue('name')),
    calendarDescription:
      safeText(root.getFirstPropertyValue('x-wr-caldesc')) ??
      safeText(root.getFirstPropertyValue('description')),
    timezone: safeText(root.getFirstPropertyValue('x-wr-timezone')),
    method: safeText(root.getFirstPropertyValue('method')),
    scale: safeText(root.getFirstPropertyValue('calscale'))
  };
}

function mapMasterEvent(
  component: IcalComponent,
  colorIndex: number,
  calendarName: string | undefined,
  index: number
): IcsCalendarEvent | null {
  try {
    const event = new ICAL.Event(component as never) as IcalEvent;
    const start = toJsDate(event.startDate);
    const allDay = isAllDayEvent(event);
    const end = endFromEvent(event, start, allDay);
    const uid = safeText(event.uid) ?? `event-${index}`;
    const title = safeText(event.summary) ?? '(No title)';
    const tzid =
      safeText(component.getFirstProperty('dtstart')?.getParameter('tzid')) ??
      (event.startDate?.zone ? safeText(event.startDate.zone.tzid) : undefined);

    const createdRaw = component.getFirstPropertyValue('created');
    const modifiedRaw = component.getFirstPropertyValue('last-modified');
    const priorityRaw = component.getFirstPropertyValue('priority');
    const sequenceRaw = component.getFirstPropertyValue('sequence');

    return {
      id: `${uid}::master`,
      uid,
      title,
      description: safeText(event.description),
      location: safeText(event.location),
      start,
      end,
      allDay,
      timezone: tzid,
      status: safeText(event.status),
      classification: safeText(component.getFirstPropertyValue('class')),
      categories: parseCategories(component),
      organizer: readParticipant(component.getFirstProperty('organizer')),
      attendees: readAttendees(component),
      recurrence: readRecurrence(component, event),
      reminders: readReminders(component),
      url: safeText(component.getFirstPropertyValue('url')),
      priority: priorityRaw != null ? Number(priorityRaw) : undefined,
      sequence: sequenceRaw != null ? Number(sequenceRaw) : undefined,
      created:
        createdRaw && typeof createdRaw === 'object' && 'toJSDate' in (createdRaw as object)
          ? toJsDate(createdRaw as IcalTime)
          : undefined,
      lastModified:
        modifiedRaw && typeof modifiedRaw === 'object' && 'toJSDate' in (modifiedRaw as object)
          ? toJsDate(modifiedRaw as IcalTime)
          : undefined,
      calendarName,
      colorIndex: colorIndex % ICS_EVENT_COLORS.length,
      isOccurrence: false,
      spanDays: spanDaysFor(start, end, allDay)
    };
  } catch {
    return null;
  }
}

/**
 * Parse ICS text into calendar metadata and master events.
 * Unsupported optional properties are ignored; parse failures on individual
 * events become warnings instead of failing the whole calendar.
 */
export function parseIcsText(text: string, colorIndex = 0): IcsParseResult {
  const trimmed = text?.trim() ?? '';
  if (!trimmed) {
    throw new Error('The calendar file is empty.');
  }
  if (!/BEGIN:VCALENDAR/i.test(trimmed)) {
    throw new Error('Not a valid iCalendar file (missing BEGIN:VCALENDAR).');
  }

  let jcal: unknown;
  try {
    jcal = ICAL.parse(trimmed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown parse error';
    throw new Error(`Could not parse ICS: ${message}`);
  }

  const root = new ICAL.Component(jcal as never) as unknown as IcalComponent;
  if (root.name !== 'vcalendar') {
    throw new Error('ICS root component must be VCALENDAR.');
  }

  const meta = readCalendarMeta(root);
  const warnings: string[] = [];
  const masters: IcsCalendarEvent[] = [];
  const vevents = root.getAllSubcomponents('vevent');

  if (vevents.length === 0) {
    warnings.push('Calendar contains no VEVENT components.');
  }

  vevents.forEach((comp, index) => {
    const mapped = mapMasterEvent(comp as IcalComponent, colorIndex, meta.calendarName, index);
    if (mapped) {
      masters.push(mapped);
    } else {
      warnings.push(`Skipped unreadable event at index ${index + 1}.`);
    }
  });

  const unsupported = root.getAllSubcomponents('vtodo').length + root.getAllSubcomponents('vjournal').length;
  if (unsupported > 0) {
    warnings.push(`${unsupported} non-event component(s) (VTODO/VJOURNAL) were ignored.`);
  }

  return { meta, masters, warnings };
}

function cloneOccurrence(
  master: IcsCalendarEvent,
  occurrenceStart: Date,
  durationMs: number
): IcsCalendarEvent {
  const start = new Date(occurrenceStart);
  const end = new Date(start.getTime() + durationMs);
  return {
    ...master,
    id: `${master.uid}::${start.toISOString()}`,
    start,
    end,
    isOccurrence: true,
    occurrenceStart: start,
    spanDays: spanDaysFor(start, end, master.allDay),
    reminders: [...master.reminders],
    attendees: [...master.attendees],
    categories: [...master.categories]
  };
}

/**
 * Expand recurring masters into occurrences that intersect [rangeStart, rangeEnd].
 * Non-recurring events are included when they overlap the range.
 */
export function expandEventsForRange(
  masters: ReadonlyArray<IcsCalendarEvent>,
  rangeStart: Date,
  rangeEnd: Date,
  rawComponentsByUid?: Map<string, IcalComponent>
): IcsCalendarEvent[] {
  const results: IcsCalendarEvent[] = [];
  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  for (const master of masters) {
    const durationMs = Math.max(60_000, master.end.getTime() - master.start.getTime());

    if (!master.recurrence?.rrule && !(master.recurrence?.rdates.length ?? 0)) {
      if (master.end.getTime() > rangeStartMs && master.start.getTime() < rangeEndMs) {
        results.push(master);
      }
      continue;
    }

    const component = rawComponentsByUid?.get(master.uid);
    if (!component) {
      // Fallback: include master if it overlaps when recurrence component missing.
      if (master.end.getTime() > rangeStartMs && master.start.getTime() < rangeEndMs) {
        results.push(master);
      }
      continue;
    }

    try {
      const icalEvent = new ICAL.Event(component as never) as IcalEvent;
      const expansion = new ICAL.RecurExpansion({
        component,
        dtstart: icalEvent.startDate
      });

      let count = 0;
      while (!expansion.complete && count < ICS_MAX_RECURRENCE_OCCURRENCES) {
        const next = expansion.next();
        if (!next) {
          break;
        }
        const occStart = toJsDate(next as IcalTime);
        const occEnd = new Date(occStart.getTime() + durationMs);
        count += 1;

        // Stop once occurrences start after the visible range.
        if (occStart.getTime() > rangeEndMs) {
          break;
        }
        if (occEnd.getTime() <= rangeStartMs) {
          continue;
        }
        results.push(cloneOccurrence(master, occStart, durationMs));
      }
    } catch {
      if (master.end.getTime() > rangeStartMs && master.start.getTime() < rangeEndMs) {
        results.push(master);
      }
    }
  }

  return results.sort((a, b) => a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title));
}

/**
 * Parse ICS and retain UID → component map for recurrence expansion.
 */
export function parseIcsWithComponents(
  text: string,
  colorIndex = 0
): IcsParseResult & { componentsByUid: Map<string, IcalComponent> } {
  const result = parseIcsText(text, colorIndex);
  const componentsByUid = new Map<string, IcalComponent>();

  try {
    const jcal = ICAL.parse(text.trim());
    const root = new ICAL.Component(jcal as never) as unknown as IcalComponent;
    for (const comp of root.getAllSubcomponents('vevent')) {
      const uid = safeText(comp.getFirstPropertyValue('uid'));
      if (uid) {
        componentsByUid.set(uid, comp as IcalComponent);
      }
    }
  } catch {
    /* components optional for non-recurring */
  }

  return { ...result, componentsByUid };
}

export function eventColor(colorIndex: number): string {
  return ICS_EVENT_COLORS[colorIndex % ICS_EVENT_COLORS.length];
}

export function sanitizeIcsUrl(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return null;
  }
  return null;
}
