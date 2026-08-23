/** Synthetic warehouse timeline with overlapping cases (education / research). */

function iso(base: string, minutes: number): string {
  return new Date(Date.parse(base) + minutes * 60000).toISOString();
}

export interface TimelineSampleTrace {
  caseId: string;
  events: Array<{ activity: string; timestamp: string; resource: string }>;
}

export function buildProcessTimelineSampleTraces(): TimelineSampleTrace[] {
  const plans: Array<{ caseId: string; start: string; owner: string; packer: string }> = [
    { caseId: 'W1', start: '2024-04-01T08:00:00.000Z', owner: 'Alice', packer: 'Cara' },
    { caseId: 'W2', start: '2024-04-01T08:40:00.000Z', owner: 'Bob', packer: 'Cara' },
    { caseId: 'W3', start: '2024-04-01T09:15:00.000Z', owner: 'Alice', packer: 'Bob' },
    { caseId: 'W4', start: '2024-04-01T10:00:00.000Z', owner: 'Dana', packer: 'Cara' }
  ];
  return plans.map((plan) => ({
    caseId: plan.caseId,
    events: [
      { activity: 'Receive', timestamp: iso(plan.start, 0), resource: plan.owner },
      { activity: 'Pick', timestamp: iso(plan.start, 45), resource: plan.owner },
      { activity: 'Pack', timestamp: iso(plan.start, 110), resource: plan.packer },
      { activity: 'Ship', timestamp: iso(plan.start, 170), resource: 'Cara' }
    ]
  }));
}

export function buildProcessTimelineSampleObject(): Record<string, unknown> {
  return {
    name: 'Warehouse timeline',
    traces: buildProcessTimelineSampleTraces()
  };
}

function xesEvent(activity: string, timestamp: string, resource: string): string {
  return `    <event>
      <string key="concept:name" value="${activity}"/>
      <date key="time:timestamp" value="${timestamp}"/>
      <string key="org:resource" value="${resource}"/>
    </event>`;
}

function xesTrace(trace: TimelineSampleTrace): string {
  const events = trace.events.map((e) => xesEvent(e.activity, e.timestamp, e.resource)).join('\n');
  return `  <trace>
    <string key="concept:name" value="${trace.caseId}"/>
${events}
  </trace>`;
}

export const PROCESS_TIMELINE_XES_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<log xes.version="1.0">
  <string key="concept:name" value="Warehouse timeline"/>
${buildProcessTimelineSampleTraces().map(xesTrace).join('\n')}
</log>
`;

export const PROCESS_TIMELINE_JSON_SAMPLE = JSON.stringify(buildProcessTimelineSampleObject(), null, 2);

export const PROCESS_TIMELINE_CSV_SAMPLE = [
  'case,activity,timestamp,resource',
  ...buildProcessTimelineSampleTraces().flatMap((t) =>
    t.events.map((e) => `${t.caseId},${e.activity},${e.timestamp},${e.resource}`)
  )
].join('\n');
