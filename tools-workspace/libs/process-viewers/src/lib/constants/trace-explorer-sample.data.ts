/** Synthetic insurance-claim traces with case attributes (education / research). */

const APPROVE = ['Register', 'Review', 'Approve', 'Pay'];
const REJECT = ['Register', 'Review', 'Reject'];

function iso(base: string, hours: number): string {
  return new Date(Date.parse(base) + hours * 3600000).toISOString();
}

export interface TraceSampleTrace {
  caseId: string;
  attributes: Record<string, string>;
  events: Array<{ activity: string; timestamp: string; resource: string }>;
}

export function buildTraceExplorerSampleTraces(): TraceSampleTrace[] {
  const plans: Array<{
    caseId: string;
    path: string[];
    start: string;
    channel: string;
    priority: string;
    amount: string;
    owner: string;
  }> = [
    { caseId: 'CLM1', path: APPROVE, start: '2024-02-01T08:00:00.000Z', channel: 'web', priority: 'high', amount: '2400', owner: 'Maya' },
    { caseId: 'CLM2', path: REJECT, start: '2024-02-01T09:15:00.000Z', channel: 'phone', priority: 'low', amount: '180', owner: 'Noah' },
    { caseId: 'CLM3', path: APPROVE, start: '2024-02-02T07:40:00.000Z', channel: 'web', priority: 'medium', amount: '910', owner: 'Maya' },
    { caseId: 'CLM4', path: APPROVE, start: '2024-02-02T11:00:00.000Z', channel: 'email', priority: 'high', amount: '3200', owner: 'Ivy' },
    { caseId: 'CLM5', path: REJECT, start: '2024-02-03T08:20:00.000Z', channel: 'phone', priority: 'medium', amount: '450', owner: 'Noah' },
    { caseId: 'CLM6', path: APPROVE, start: '2024-02-03T13:10:00.000Z', channel: 'web', priority: 'low', amount: '75', owner: 'Ivy' }
  ];
  return plans.map((plan) => ({
    caseId: plan.caseId,
    attributes: { channel: plan.channel, priority: plan.priority, amount: plan.amount },
    events: plan.path.map((activity, i) => ({
      activity,
      timestamp: iso(plan.start, i),
      resource: i === 0 ? 'system' : plan.owner
    }))
  }));
}

export function buildTraceExplorerSampleObject(): Record<string, unknown> {
  return {
    name: 'Insurance claim traces',
    traces: buildTraceExplorerSampleTraces()
  };
}

function xesEvent(activity: string, timestamp: string, resource: string): string {
  return `    <event>
      <string key="concept:name" value="${activity}"/>
      <date key="time:timestamp" value="${timestamp}"/>
      <string key="org:resource" value="${resource}"/>
    </event>`;
}

function xesTrace(trace: TraceSampleTrace): string {
  const attrs = Object.entries(trace.attributes)
    .map(([key, value]) => `    <string key="${key}" value="${value}"/>`)
    .join('\n');
  const events = trace.events.map((e) => xesEvent(e.activity, e.timestamp, e.resource)).join('\n');
  return `  <trace>
    <string key="concept:name" value="${trace.caseId}"/>
${attrs}
${events}
  </trace>`;
}

export const TRACE_EXPLORER_XES_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<log xes.version="1.0">
  <string key="concept:name" value="Insurance claim traces"/>
${buildTraceExplorerSampleTraces().map(xesTrace).join('\n')}
</log>
`;

export const TRACE_EXPLORER_JSON_SAMPLE = JSON.stringify(buildTraceExplorerSampleObject(), null, 2);

export const TRACE_EXPLORER_CSV_SAMPLE = [
  'case,activity,timestamp,resource,channel,priority,amount',
  ...buildTraceExplorerSampleTraces().flatMap((t) =>
    t.events.map(
      (e) => `${t.caseId},${e.activity},${e.timestamp},${e.resource},${t.attributes.channel},${t.attributes.priority},${t.attributes.amount}`
    )
  )
].join('\n');
