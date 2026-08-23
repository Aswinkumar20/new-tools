/** Synthetic shop checkout FSM snippets (education / research). */

export const SM_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<scxml xmlns="http://www.w3.org/2005/07/scxml" name="ShopCheckout" initial="idle" version="1.0">
  <state id="idle">
    <transition event="start" target="cart"/>
  </state>
  <state id="cart">
    <transition event="checkout" target="payment"/>
    <transition event="cancel" target="idle"/>
  </state>
  <state id="payment">
    <transition event="paid" target="done"/>
    <transition event="fail" target="cart"/>
  </state>
  <final id="done"/>
</scxml>
`;

export const SM_JSON_SAMPLE = `{
  "name": "ShopCheckout",
  "initial": "idle",
  "states": [
    { "id": "idle", "kind": "initial" },
    { "id": "cart" },
    { "id": "done", "kind": "final" }
  ],
  "transitions": [
    { "source": "idle", "target": "cart", "event": "start" },
    { "source": "cart", "target": "done", "event": "checkout" }
  ]
}
`;

export const SM_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<fsm name="ShopCheckout" initial="idle">
  <state id="idle" kind="initial"/>
  <state id="cart"/>
  <state id="done" kind="final"/>
  <transition from="idle" to="cart" event="start"/>
  <transition from="cart" to="done" event="checkout"/>
</fsm>
`;

export const SM_MARKDOWN_SAMPLE = `# ShopCheckout

[*] --> idle
idle --> cart : start
cart --> done : checkout
`;
