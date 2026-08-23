/** Synthetic order-fulfillment event log for process mining (education / research). */

const HAPPY = ['Receive', 'Check credit', 'Pack', 'Ship', 'Invoice', 'Complete'];
const REJECT = ['Receive', 'Check credit', 'Reject'];
const INVOICE_FIRST = ['Receive', 'Check credit', 'Pack', 'Invoice', 'Ship', 'Complete'];

function iso(base: string, hours: number): string {
  return new Date(Date.parse(base) + hours * 3600000).toISOString();
}

export interface MiningSampleTrace {
  caseId: string;
  events: Array<{ activity: string; timestamp: string; resource: string }>;
}

export function buildProcessMiningSampleTraces(): MiningSampleTrace[] {
  const plans: Array<{ caseId: string; path: string[]; start: string }> = [
    { caseId: 'C1', path: HAPPY, start: '2024-01-02T08:00:00.000Z' },
    { caseId: 'C2', path: HAPPY, start: '2024-01-03T09:00:00.000Z' },
    { caseId: 'C3', path: HAPPY, start: '2024-01-04T07:30:00.000Z' },
    { caseId: 'C4', path: HAPPY, start: '2024-01-05T10:00:00.000Z' },
    { caseId: 'C5', path: HAPPY, start: '2024-01-06T08:15:00.000Z' },
    { caseId: 'C6', path: REJECT, start: '2024-01-07T11:00:00.000Z' },
    { caseId: 'C7', path: REJECT, start: '2024-01-08T12:00:00.000Z' },
    { caseId: 'C8', path: INVOICE_FIRST, start: '2024-01-09T08:45:00.000Z' }
  ];
  return plans.map((plan) => ({
    caseId: plan.caseId,
    events: plan.path.map((activity, i) => ({
      activity,
      timestamp: iso(plan.start, i),
      resource: i % 2 ? 'Bob' : 'Alice'
    }))
  }));
}

export function buildProcessMiningSampleObject(): Record<string, unknown> {
  return {
    name: 'Order fulfillment log',
    traces: buildProcessMiningSampleTraces().map((t) => ({
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
      <string key="lifecycle:transition" value="complete"/>
    </event>`;
}

function xesTrace(trace: MiningSampleTrace): string {
  const events = trace.events.map((e) => xesEvent(e.activity, e.timestamp, e.resource)).join('\n');
  return `  <trace>
    <string key="concept:name" value="${trace.caseId}"/>
${events}
  </trace>`;
}

export const PROCESS_MINING_XES_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<log xes.version="1.0" xes.features="nested-attributes">
  <extension name="Concept" prefix="concept" uri="http://www.xes-standard.org/concept.xesext"/>
  <extension name="Time" prefix="time" uri="http://www.xes-standard.org/time.xesext"/>
  <extension name="Organizational" prefix="org" uri="http://www.xes-standard.org/org.xesext"/>
  <string key="concept:name" value="Order fulfillment log"/>
${buildProcessMiningSampleTraces().map(xesTrace).join('\n')}
</log>
`;

export const PROCESS_MINING_JSON_SAMPLE = JSON.stringify(buildProcessMiningSampleObject(), null, 2);

export const PROCESS_MINING_CSV_SAMPLE = [
  'case,activity,timestamp,resource',
  ...buildProcessMiningSampleTraces().flatMap((t) =>
    t.events.map((e) => `${t.caseId},${e.activity},${e.timestamp},${e.resource}`)
  )
].join('\n');

export const PROCESS_MINING_MAP_JSON_SAMPLE = JSON.stringify(
  {
    name: 'Order fulfillment mined map',
    variants: [
      { name: 'Happy path', path: HAPPY, cases: 5 },
      { name: 'Credit reject', path: REJECT, cases: 2 },
      { name: 'Invoice before ship', path: INVOICE_FIRST, cases: 1 }
    ],
    dfg: [
      { source: 'Receive', target: 'Check credit', frequency: 8 },
      { source: 'Check credit', target: 'Pack', frequency: 6 },
      { source: 'Check credit', target: 'Reject', frequency: 2 },
      { source: 'Pack', target: 'Ship', frequency: 5 },
      { source: 'Pack', target: 'Invoice', frequency: 1 },
      { source: 'Ship', target: 'Invoice', frequency: 5 },
      { source: 'Invoice', target: 'Ship', frequency: 1 },
      { source: 'Invoice', target: 'Complete', frequency: 5 },
      { source: 'Ship', target: 'Complete', frequency: 1 }
    ]
  },
  null,
  2
);
