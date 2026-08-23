/** Synthetic support-ticket event log (education / research). */

const CRITICAL = ['Ticket opened', 'Triage', 'Fix critical', 'Notify customer', 'Ticket closed'];
const SCHEDULE = ['Ticket opened', 'Triage', 'Schedule fix', 'Notify customer', 'Ticket closed'];

function iso(base: string, minutes: number): string {
  return new Date(Date.parse(base) + minutes * 60000).toISOString();
}

export interface EventLogSampleTrace {
  caseId: string;
  events: Array<{ activity: string; timestamp: string; resource: string }>;
}

export function buildEventLogSampleTraces(): EventLogSampleTrace[] {
  const plans: Array<{ caseId: string; path: string[]; start: string; owner: string }> = [
    { caseId: 'T1', path: CRITICAL, start: '2024-03-01T08:00:00.000Z', owner: 'Alex' },
    { caseId: 'T2', path: SCHEDULE, start: '2024-03-01T09:30:00.000Z', owner: 'Sam' },
    { caseId: 'T3', path: CRITICAL, start: '2024-03-02T07:45:00.000Z', owner: 'Alex' },
    { caseId: 'T4', path: SCHEDULE, start: '2024-03-02T11:00:00.000Z', owner: 'Sam' },
    { caseId: 'T5', path: CRITICAL, start: '2024-03-03T08:20:00.000Z', owner: 'Riley' },
    { caseId: 'T6', path: SCHEDULE, start: '2024-03-03T13:10:00.000Z', owner: 'Sam' }
  ];
  return plans.map((plan) => ({
    caseId: plan.caseId,
    events: plan.path.map((activity, i) => ({
      activity,
      timestamp: iso(plan.start, i * 25),
      resource: i === 0 || activity === 'Ticket closed' ? 'system' : plan.owner
    }))
  }));
}

export function buildEventLogSampleObject(): Record<string, unknown> {
  return {
    name: 'Support ticket log',
    traces: buildEventLogSampleTraces().map((t) => ({
      caseId: t.caseId,
      events: t.events
    }))
  };
}

function xesEvent(activity: string, timestamp: string, resource: string): string {
  return `    <event>
      <string key="concept:name" value="${activity}"/>
      <date key="time:timestamp" value="${timestamp}"/>
      <string key="org:resource" value="${resource}"/>
    </event>`;
}

function xesTrace(trace: EventLogSampleTrace): string {
  const events = trace.events.map((e) => xesEvent(e.activity, e.timestamp, e.resource)).join('\n');
  return `  <trace>
    <string key="concept:name" value="${trace.caseId}"/>
${events}
  </trace>`;
}

export const EVENT_LOG_XES_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<log xes.version="1.0">
  <string key="concept:name" value="Support ticket log"/>
${buildEventLogSampleTraces().map(xesTrace).join('\n')}
</log>
`;

export const EVENT_LOG_JSON_SAMPLE = JSON.stringify(buildEventLogSampleObject(), null, 2);

export const EVENT_LOG_CSV_SAMPLE = [
  'case,activity,timestamp,resource',
  ...buildEventLogSampleTraces().flatMap((t) =>
    t.events.map((e) => `${t.caseId},${e.activity},${e.timestamp},${e.resource}`)
  )
].join('\n');
