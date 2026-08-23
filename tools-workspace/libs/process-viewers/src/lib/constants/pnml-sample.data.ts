/** Synthetic PNML 1.3 P/T order net (education / research). */

export const PNML_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="n1" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <name><text>Order fulfillment</text></name>
    <page id="page1">
      <place id="p_incoming">
        <name><text>Incoming orders</text></name>
        <initialMarking><text>3</text></initialMarking>
        <graphics><position x="40" y="80"/></graphics>
      </place>
      <place id="p_review">
        <name><text>In credit review</text></name>
        <initialMarking><text>0</text></initialMarking>
        <graphics><position x="280" y="80"/></graphics>
      </place>
      <place id="p_approved">
        <name><text>Approved</text></name>
        <initialMarking><text>1</text></initialMarking>
        <graphics><position x="520" y="40"/></graphics>
      </place>
      <place id="p_rejected">
        <name><text>Rejected</text></name>
        <initialMarking><text>0</text></initialMarking>
        <graphics><position x="520" y="160"/></graphics>
      </place>
      <place id="p_packed">
        <name><text>Packed</text></name>
        <initialMarking><text>0</text></initialMarking>
        <graphics><position x="760" y="40"/></graphics>
      </place>
      <place id="p_shipped">
        <name><text>Shipped</text></name>
        <initialMarking><text>0</text></initialMarking>
        <graphics><position x="1000" y="40"/></graphics>
      </place>
      <place id="p_done">
        <name><text>Completed</text></name>
        <initialMarking><text>0</text></initialMarking>
        <graphics><position x="1240" y="80"/></graphics>
      </place>
      <transition id="t_accept">
        <name><text>Accept order</text></name>
        <graphics><position x="160" y="80"/></graphics>
      </transition>
      <transition id="t_review">
        <name><text>Review credit</text></name>
        <graphics><position x="400" y="40"/></graphics>
      </transition>
      <transition id="t_reject">
        <name><text>Reject order</text></name>
        <graphics><position x="400" y="160"/></graphics>
      </transition>
      <transition id="t_pack">
        <name><text>Pack goods</text></name>
        <graphics><position x="640" y="40"/></graphics>
      </transition>
      <transition id="t_ship">
        <name><text>Ship order</text></name>
        <graphics><position x="880" y="40"/></graphics>
      </transition>
      <transition id="t_complete">
        <name><text>Complete order</text></name>
        <graphics><position x="1120" y="80"/></graphics>
      </transition>
      <arc id="a1" source="p_incoming" target="t_accept"><inscription><text>1</text></inscription></arc>
      <arc id="a2" source="t_accept" target="p_review"><inscription><text>1</text></inscription></arc>
      <arc id="a3" source="p_review" target="t_review"><inscription><text>1</text></inscription></arc>
      <arc id="a4" source="t_review" target="p_approved"><inscription><text>1</text></inscription></arc>
      <arc id="a5" source="p_review" target="t_reject"><inscription><text>1</text></inscription></arc>
      <arc id="a6" source="t_reject" target="p_rejected"><inscription><text>1</text></inscription></arc>
      <arc id="a7" source="p_approved" target="t_pack"><inscription><text>1</text></inscription></arc>
      <arc id="a8" source="t_pack" target="p_packed"><inscription><text>1</text></inscription></arc>
      <arc id="a9" source="p_packed" target="t_ship"><inscription><text>1</text></inscription></arc>
      <arc id="a10" source="t_ship" target="p_shipped"><inscription><text>1</text></inscription></arc>
      <arc id="a11" source="p_shipped" target="t_complete"><inscription><text>1</text></inscription></arc>
      <arc id="a12" source="t_complete" target="p_done"><inscription><text>1</text></inscription></arc>
    </page>
  </net>
</pnml>
`;

export const PNML_JSON_SAMPLE = JSON.stringify(
  {
    name: 'Order fulfillment',
    netType: 'http://www.pnml.org/version-2009/grammar/ptnet',
    places: [
      { id: 'p_incoming', name: 'Incoming orders', tokens: 3, x: 40, y: 80 },
      { id: 'p_review', name: 'In credit review', tokens: 0, x: 280, y: 80 },
      { id: 'p_approved', name: 'Approved', tokens: 1, x: 520, y: 40 }
    ],
    transitions: [
      { id: 't_accept', name: 'Accept order', x: 160, y: 80 },
      { id: 't_review', name: 'Review credit', x: 400, y: 40 },
      { id: 't_pack', name: 'Pack goods', x: 640, y: 40 }
    ],
    arcs: [
      { source: 'p_incoming', target: 't_accept', weight: 1 },
      { source: 't_accept', target: 'p_review', weight: 1 },
      { source: 'p_review', target: 't_review', weight: 1 },
      { source: 't_review', target: 'p_approved', weight: 1 },
      { source: 'p_approved', target: 't_pack', weight: 1 }
    ]
  },
  null,
  2
);

export const PNML_CSV_SAMPLE = `type,id,name,tokens,source,target,weight
place,p_incoming,Incoming orders,3,,,
place,p_review,In credit review,0,,,
place,p_approved,Approved,1,,,
transition,t_accept,Accept order,,,,
transition,t_review,Review credit,,,,
arc,a1,,,p_incoming,t_accept,1
arc,a2,,,t_accept,p_review,1
arc,a3,,,p_review,t_review,1
arc,a4,,,t_review,p_approved,1
`;
