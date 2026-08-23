/** Synthetic EPML order-fulfillment chain (education / research). */

export const EPC_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<epml:epml xmlns:epml="http://www.epml.de">
  <epc epcId="EPC_Order" name="Order fulfillment">
    <event id="E1" name="Order received"><graphics><position x="40" y="70"/></graphics></event>
    <function id="F1" name="Check credit"><graphics><position x="160" y="70"/></graphics></function>
    <xor id="XOR1" name="Credit OK?"><graphics><position x="280" y="70"/></graphics></xor>
    <event id="E2" name="Credit approved"><graphics><position x="400" y="40"/></graphics></event>
    <function id="F3" name="Reserve stock"><graphics><position x="520" y="40"/></graphics></function>
    <and id="AND1" name="Ship and invoice"><graphics><position x="640" y="70"/></graphics></and>
    <function id="F4" name="Ship goods"><graphics><position x="760" y="40"/></graphics></function>
    <event id="E4" name="Goods shipped"><graphics><position x="880" y="40"/></graphics></event>
    <and id="AND2" name="Join fulfillment"><graphics><position x="1000" y="70"/></graphics></and>
    <function id="F6" name="Close order"><graphics><position x="1120" y="70"/></graphics></function>
    <event id="E6" name="Order completed"><graphics><position x="1240" y="70"/></graphics></event>
    <event id="E3" name="Credit rejected"><graphics><position x="400" y="160"/></graphics></event>
    <function id="F2" name="Notify rejection"><graphics><position x="520" y="160"/></graphics></function>
    <event id="E7" name="Order cancelled"><graphics><position x="640" y="160"/></graphics></event>
    <function id="F5" name="Send invoice"><graphics><position x="760" y="160"/></graphics></function>
    <event id="E5" name="Invoice sent"><graphics><position x="880" y="160"/></graphics></event>
    <arc id="A1" from="E1" to="F1"/>
    <arc id="A2" from="F1" to="XOR1"/>
    <arc id="A3" from="XOR1" to="E2" name="yes"/>
    <arc id="A4" from="XOR1" to="E3" name="no"/>
    <arc id="A5" from="E2" to="F3"/>
    <arc id="A6" from="F3" to="AND1"/>
    <arc id="A7" from="AND1" to="F4"/>
    <arc id="A8" from="AND1" to="F5"/>
    <arc id="A9" from="F4" to="E4"/>
    <arc id="A10" from="F5" to="E5"/>
    <arc id="A11" from="E4" to="AND2"/>
    <arc id="A12" from="E5" to="AND2"/>
    <arc id="A13" from="AND2" to="F6"/>
    <arc id="A14" from="F6" to="E6"/>
    <arc id="A15" from="E3" to="F2"/>
    <arc id="A16" from="F2" to="E7"/>
  </epc>
</epml:epml>
`;

export const EPC_JSON_SAMPLE = JSON.stringify(
  {
    name: 'Order fulfillment',
    nodes: [
      { id: 'E1', name: 'Order received', kind: 'event', x: 40, y: 70 },
      { id: 'F1', name: 'Check credit', kind: 'function', x: 160, y: 70 },
      { id: 'XOR1', name: 'Credit OK?', kind: 'xor', x: 280, y: 70 },
      { id: 'E2', name: 'Credit approved', kind: 'event', x: 400, y: 40 },
      { id: 'E3', name: 'Credit rejected', kind: 'event', x: 400, y: 160 }
    ],
    flows: [
      { source: 'E1', target: 'F1' },
      { source: 'F1', target: 'XOR1' },
      { source: 'XOR1', target: 'E2', label: 'yes' },
      { source: 'XOR1', target: 'E3', label: 'no' }
    ]
  },
  null,
  2
);

export const EPC_CSV_SAMPLE = `kind,id,name,from,to
event,E1,Order received,,
function,F1,Check credit,E1,
xor,XOR1,Credit OK?,F1,
event,E2,Credit approved,XOR1,
event,E3,Credit rejected,XOR1,
`;
