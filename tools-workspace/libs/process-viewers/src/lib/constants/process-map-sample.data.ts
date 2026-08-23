/** Synthetic discovered order-fulfillment process map (education / research). */

export function buildProcessMapSampleObject(): Record<string, unknown> {
  return {
    name: 'Order fulfillment map',
    cases: 1200,
    activities: [
      { id: 'a_receive', name: 'Receive', frequency: 1200, avgDurationMs: 120000 },
      { id: 'a_credit', name: 'Check credit', frequency: 1200, avgDurationMs: 540000 },
      { id: 'a_pack', name: 'Pack', frequency: 980, avgDurationMs: 900000 },
      { id: 'a_ship', name: 'Ship', frequency: 980, avgDurationMs: 1800000 },
      { id: 'a_invoice', name: 'Invoice', frequency: 980, avgDurationMs: 300000 },
      { id: 'a_complete', name: 'Complete', frequency: 980, avgDurationMs: 60000 },
      { id: 'a_reject', name: 'Reject', frequency: 220, avgDurationMs: 180000 }
    ],
    flows: [
      { source: 'Receive', target: 'Check credit', frequency: 1200 },
      { source: 'Check credit', target: 'Pack', frequency: 980 },
      { source: 'Check credit', target: 'Reject', frequency: 220 },
      { source: 'Pack', target: 'Ship', frequency: 850 },
      { source: 'Pack', target: 'Invoice', frequency: 130 },
      { source: 'Ship', target: 'Invoice', frequency: 850 },
      { source: 'Invoice', target: 'Ship', frequency: 130 },
      { source: 'Invoice', target: 'Complete', frequency: 850 },
      { source: 'Ship', target: 'Complete', frequency: 130 }
    ],
    variants: [
      {
        id: 'v1',
        name: 'Happy path',
        path: ['Receive', 'Check credit', 'Pack', 'Ship', 'Invoice', 'Complete'],
        cases: 850
      },
      {
        id: 'v2',
        name: 'Credit reject',
        path: ['Receive', 'Check credit', 'Reject'],
        cases: 220
      },
      {
        id: 'v3',
        name: 'Invoice before ship',
        path: ['Receive', 'Check credit', 'Pack', 'Invoice', 'Ship', 'Complete'],
        cases: 130
      }
    ]
  };
}

export const PROCESS_MAP_JSON_SAMPLE = JSON.stringify(buildProcessMapSampleObject(), null, 2);

export const PROCESS_MAP_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<processMap name="Order fulfillment map" cases="1200">
  <activity id="a_receive" name="Receive" frequency="1200" avgDurationMs="120000"/>
  <activity id="a_credit" name="Check credit" frequency="1200" avgDurationMs="540000"/>
  <activity id="a_pack" name="Pack" frequency="980" avgDurationMs="900000"/>
  <activity id="a_reject" name="Reject" frequency="220" avgDurationMs="180000"/>
  <flow source="Receive" target="Check credit" frequency="1200"/>
  <flow source="Check credit" target="Pack" frequency="980"/>
  <flow source="Check credit" target="Reject" frequency="220"/>
  <variant id="v1" name="Happy path" cases="850" path="Receive>Check credit>Pack>Ship>Invoice>Complete"/>
  <variant id="v2" name="Credit reject" cases="220" path="Receive>Check credit>Reject"/>
</processMap>
`;

export const PROCESS_MAP_CSV_SAMPLE = `type,name,frequency,path,cases
activity,Receive,1200,,
activity,Check credit,1200,,
activity,Pack,980,,
activity,Reject,220,,
flow,Receive>Check credit,1200,,
flow,Check credit>Pack,980,,
flow,Check credit>Reject,220,,
variant,Happy path,850,Receive>Check credit>Pack>Ship>Invoice>Complete,850
variant,Credit reject,220,Receive>Check credit>Reject,220
`;
