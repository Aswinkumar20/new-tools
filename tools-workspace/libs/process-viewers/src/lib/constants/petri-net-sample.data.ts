/** Synthetic PNML vending-machine net for token-flow simulation (education / research). */

export const PETRI_NET_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="n_vending" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <name><text>Vending machine</text></name>
    <page id="page1">
      <place id="p_idle">
        <name><text>Idle</text></name>
        <initialMarking><text>1</text></initialMarking>
        <graphics><position x="40" y="80"/></graphics>
      </place>
      <place id="p_coins">
        <name><text>Coin inserted</text></name>
        <initialMarking><text>0</text></initialMarking>
        <graphics><position x="280" y="80"/></graphics>
      </place>
      <place id="p_stock">
        <name><text>Stock</text></name>
        <initialMarking><text>3</text></initialMarking>
        <graphics><position x="280" y="200"/></graphics>
      </place>
      <place id="p_selected">
        <name><text>Item selected</text></name>
        <initialMarking><text>0</text></initialMarking>
        <graphics><position x="520" y="80"/></graphics>
      </place>
      <place id="p_dispensed">
        <name><text>Dispensed</text></name>
        <initialMarking><text>0</text></initialMarking>
        <graphics><position x="760" y="80"/></graphics>
      </place>
      <transition id="t_insert">
        <name><text>Insert coin</text></name>
        <graphics><position x="160" y="80"/></graphics>
      </transition>
      <transition id="t_select">
        <name><text>Select item</text></name>
        <graphics><position x="400" y="80"/></graphics>
      </transition>
      <transition id="t_vend">
        <name><text>Vend item</text></name>
        <graphics><position x="640" y="80"/></graphics>
      </transition>
      <arc id="a1" source="p_idle" target="t_insert"><inscription><text>1</text></inscription></arc>
      <arc id="a2" source="t_insert" target="p_coins"><inscription><text>1</text></inscription></arc>
      <arc id="a3" source="p_coins" target="t_select"><inscription><text>1</text></inscription></arc>
      <arc id="a4" source="p_stock" target="t_select"><inscription><text>1</text></inscription></arc>
      <arc id="a5" source="t_select" target="p_selected"><inscription><text>1</text></inscription></arc>
      <arc id="a6" source="p_selected" target="t_vend"><inscription><text>1</text></inscription></arc>
      <arc id="a7" source="t_vend" target="p_dispensed"><inscription><text>1</text></inscription></arc>
      <arc id="a8" source="t_vend" target="p_idle"><inscription><text>1</text></inscription></arc>
    </page>
  </net>
</pnml>
`;

export const PETRI_NET_JSON_SAMPLE = JSON.stringify(
  {
    name: 'Vending machine',
    netType: 'http://www.pnml.org/version-2009/grammar/ptnet',
    places: [
      { id: 'p_idle', name: 'Idle', tokens: 1, x: 40, y: 80 },
      { id: 'p_coins', name: 'Coin inserted', tokens: 0, x: 280, y: 80 },
      { id: 'p_stock', name: 'Stock', tokens: 3, x: 280, y: 200 }
    ],
    transitions: [
      { id: 't_insert', name: 'Insert coin', x: 160, y: 80 },
      { id: 't_select', name: 'Select item', x: 400, y: 80 }
    ],
    arcs: [
      { source: 'p_idle', target: 't_insert', weight: 1 },
      { source: 't_insert', target: 'p_coins', weight: 1 },
      { source: 'p_coins', target: 't_select', weight: 1 },
      { source: 'p_stock', target: 't_select', weight: 1 }
    ]
  },
  null,
  2
);

export const PETRI_NET_CSV_SAMPLE = `type,id,name,tokens,source,target,weight
place,p_idle,Idle,1,,,
place,p_coins,Coin inserted,0,,,
place,p_stock,Stock,3,,,
transition,t_insert,Insert coin,,,,
transition,t_select,Select item,,,,
arc,a1,,,p_idle,t_insert,1
arc,a2,,,t_insert,p_coins,1
arc,a3,,,p_coins,t_select,1
arc,a4,,,p_stock,t_select,1
`;
