/** Synthetic checkout sequence snippets (education / research). */

export const SEQ_PUML_SAMPLE = `@startuml Checkout
title Checkout interaction
actor User
participant Shop
participant Pay
User -> Shop: Checkout
Shop -> Pay: Charge
Pay --> Shop: OK
Shop --> User: Receipt
@enduml
`;

export const SEQ_MERMAID_SAMPLE = `sequenceDiagram
  actor U as User
  participant S as Shop
  U->>S: Pay
  S-->>U: OK
`;

export const SEQ_JSON_SAMPLE = `{
  "name": "Checkout sequence",
  "lifelines": [
    { "id": "User", "name": "User", "kind": "actor" },
    { "id": "Shop", "name": "Shop", "kind": "participant" },
    { "id": "Pay", "name": "Pay", "kind": "participant" }
  ],
  "messages": [
    { "source": "User", "target": "Shop", "label": "Checkout", "style": "sync" },
    { "source": "Shop", "target": "Pay", "label": "Charge", "style": "sync" },
    { "source": "Pay", "target": "Shop", "label": "OK", "style": "return" }
  ]
}
`;

export const SEQ_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<sequence name="Checkout">
  <lifeline id="User" name="User" kind="actor"/>
  <lifeline id="Shop" name="Shop" kind="participant"/>
  <message source="User" target="Shop" label="Checkout" style="sync"/>
  <message source="Shop" target="User" label="Receipt" style="return"/>
</sequence>
`;

export const SEQ_MARKDOWN_SAMPLE = `# Checkout

\`\`\`plantuml
@startuml
actor Buyer
participant Cart
Buyer -> Cart: Add
Cart --> Buyer: Updated
@enduml
\`\`\`
`;
