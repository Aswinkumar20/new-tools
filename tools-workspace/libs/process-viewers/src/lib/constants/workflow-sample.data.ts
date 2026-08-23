/** Synthetic support-ticket workflow diagram (education / research). */

export const WORKFLOW_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<workflow name="Support ticket" id="WF_Support">
  <node id="n_start" name="Ticket opened" kind="start"><graphics><position x="40" y="90"/></graphics></node>
  <node id="n_triage" name="Triage" kind="task"><graphics><position x="180" y="90"/></graphics></node>
  <node id="n_sev" name="Severity?" kind="decision"><graphics><position x="320" y="90"/></graphics></node>
  <node id="n_critical" name="Fix critical" kind="task"><graphics><position x="480" y="40"/></graphics></node>
  <node id="n_schedule" name="Schedule fix" kind="task"><graphics><position x="480" y="150"/></graphics></node>
  <node id="n_join" name="Join" kind="join"><graphics><position x="640" y="90"/></graphics></node>
  <node id="n_notify" name="Notify customer" kind="task"><graphics><position x="780" y="90"/></graphics></node>
  <node id="n_end" name="Ticket closed" kind="end"><graphics><position x="920" y="90"/></graphics></node>
  <edge id="e1" source="n_start" target="n_triage"/>
  <edge id="e2" source="n_triage" target="n_sev"/>
  <edge id="e3" source="n_sev" target="n_critical" label="high"/>
  <edge id="e4" source="n_sev" target="n_schedule" label="low"/>
  <edge id="e5" source="n_critical" target="n_join"/>
  <edge id="e6" source="n_schedule" target="n_join"/>
  <edge id="e7" source="n_join" target="n_notify"/>
  <edge id="e8" source="n_notify" target="n_end"/>
</workflow>
`;

export const WORKFLOW_JSON_SAMPLE = JSON.stringify(
  {
    name: 'Support ticket',
    nodes: [
      { id: 'n_start', name: 'Ticket opened', kind: 'start', x: 40, y: 90 },
      { id: 'n_triage', name: 'Triage', kind: 'task', x: 180, y: 90 },
      { id: 'n_sev', name: 'Severity?', kind: 'decision', x: 320, y: 90 },
      { id: 'n_critical', name: 'Fix critical', kind: 'task', x: 480, y: 40 },
      { id: 'n_end', name: 'Ticket closed', kind: 'end', x: 620, y: 90 }
    ],
    edges: [
      { source: 'n_start', target: 'n_triage' },
      { source: 'n_triage', target: 'n_sev' },
      { source: 'n_sev', target: 'n_critical', label: 'high' },
      { source: 'n_critical', target: 'n_end' }
    ]
  },
  null,
  2
);

export const WORKFLOW_CSV_SAMPLE = `kind,id,name,from,to
start,n_start,Ticket opened,,
task,n_triage,Triage,n_start,
decision,n_sev,Severity?,n_triage,
task,n_critical,Fix critical,n_sev,
end,n_end,Ticket closed,n_critical,
`;
