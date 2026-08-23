/** Synthetic order-fulfillment BPMN for token / scenario simulation (education / research). */

export const BPSIM_BPMN_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://www.omg.org/spec/BPMN/20100524/MODEL" id="defs_order" name="Order fulfillment">
  <process id="OrderFulfillment" name="Order fulfillment" isExecutable="false">
    <startEvent id="start" name="Order received"/>
    <task id="receive" name="Receive order"/>
    <exclusiveGateway id="check" name="In stock?"/>
    <task id="wait" name="Wait restock"/>
    <task id="pack" name="Pack"/>
    <task id="ship" name="Ship"/>
    <endEvent id="end" name="Done"/>
    <sequenceFlow id="f1" sourceRef="start" targetRef="receive"/>
    <sequenceFlow id="f2" sourceRef="receive" targetRef="check"/>
    <sequenceFlow id="f3" name="in stock" sourceRef="check" targetRef="pack"/>
    <sequenceFlow id="f4" name="backorder" sourceRef="check" targetRef="wait"/>
    <sequenceFlow id="f5" sourceRef="wait" targetRef="pack"/>
    <sequenceFlow id="f6" sourceRef="pack" targetRef="ship"/>
    <sequenceFlow id="f7" sourceRef="ship" targetRef="end"/>
  </process>
</definitions>
`;

export const BPSIM_JSON_SAMPLE = `{
  "name": "Order fulfillment",
  "engine": "bpmn",
  "nodes": [
    { "id": "start", "name": "Order received", "kind": "start", "tokens": 1 },
    { "id": "receive", "name": "Receive order", "kind": "task" },
    { "id": "check", "name": "In stock?", "kind": "gateway", "gatewayType": "xor" },
    { "id": "wait", "name": "Wait restock", "kind": "task" },
    { "id": "pack", "name": "Pack", "kind": "task" },
    { "id": "ship", "name": "Ship", "kind": "task" },
    { "id": "end", "name": "Done", "kind": "end" }
  ],
  "edges": [
    { "source": "start", "target": "receive" },
    { "source": "receive", "target": "check" },
    { "source": "check", "target": "pack", "label": "in stock" },
    { "source": "check", "target": "wait", "label": "backorder" },
    { "source": "wait", "target": "pack" },
    { "source": "pack", "target": "ship" },
    { "source": "ship", "target": "end" }
  ],
  "scenarios": [
    { "name": "Happy path", "description": "In-stock order", "marking": { "start": 1 }, "choices": { "check": "in stock" } },
    { "name": "Backorder", "description": "Wait then pack", "marking": { "start": 1 }, "choices": { "check": "backorder" } },
    { "name": "Rush", "description": "Three concurrent cases", "marking": { "start": 3 }, "choices": { "check": "in stock" } }
  ]
}
`;

export const BPSIM_CSV_SAMPLE = `type,id,name,kind,tokens,source,target,label,weight
node,start,Order received,start,1,,,
node,receive,Receive order,task,0,,,
node,check,In stock?,xor,0,,,
node,wait,Wait restock,task,0,,,
node,pack,Pack,task,0,,,
node,ship,Ship,task,0,,,
node,end,Done,end,0,,,
edge,f1,,,,start,receive,,1
edge,f2,,,,receive,check,,1
edge,f3,,,,check,pack,in stock,1
edge,f4,,,,check,wait,backorder,1
edge,f5,,,,wait,pack,,1
edge,f6,,,,pack,ship,,1
edge,f7,,,,ship,end,,1
scenario,happy,Happy path,,,,,start=1;check=in stock
scenario,backorder,Backorder,,,,,start=1;check=backorder
scenario,rush,Rush,,,,,start=3;check=in stock
`;

export const BPSIM_PNML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">
  <net id="n_counter" type="http://www.pnml.org/version-2009/grammar/ptnet">
    <name><text>Counter net</text></name>
    <page id="page1">
      <place id="p_ready">
        <name><text>Ready</text></name>
        <initialMarking><text>1</text></initialMarking>
        <graphics><position x="40" y="80"/></graphics>
      </place>
      <place id="p_done">
        <name><text>Done</text></name>
        <initialMarking><text>0</text></initialMarking>
        <graphics><position x="280" y="80"/></graphics>
      </place>
      <transition id="t_tick">
        <name><text>Tick</text></name>
        <graphics><position x="160" y="80"/></graphics>
      </transition>
      <arc id="a1" source="p_ready" target="t_tick"><inscription><text>1</text></inscription></arc>
      <arc id="a2" source="t_tick" target="p_done"><inscription><text>1</text></inscription></arc>
    </page>
  </net>
</pnml>
`;
