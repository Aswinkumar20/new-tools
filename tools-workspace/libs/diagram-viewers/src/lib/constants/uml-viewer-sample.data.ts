/** Synthetic order UML class + sequence snippets (education / research). */

export const UML_CLASS_SAMPLE = `@startuml Order
title Order domain
class Customer {
  +id: String
}
class Order {
  +id: String
  +total(): Money
}
interface Payable
Customer --> Order : places
Order ..|> Payable
@enduml
`;

export const UML_SEQUENCE_SAMPLE = `@startuml Checkout
actor User
participant Shop
User -> Shop: Checkout
Shop --> User: Receipt
@enduml
`;

export const UML_MERMAID_SEQUENCE_SAMPLE = `sequenceDiagram
  participant U as User
  participant S as Shop
  U->>S: Pay
  S-->>U: OK
`;

export const UML_XMI_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:uml="http://www.omg.org/spec/UML/20131001" xmlns:xmi="http://www.omg.org/spec/XMI/20131001">
  <uml:Model name="Shop">
    <packagedElement xmi:type="uml:Class" xmi:id="c1" name="Order">
      <ownedAttribute name="id" visibility="public"/>
      <ownedOperation name="total"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Class" xmi:id="c2" name="Customer"/>
    <packagedElement xmi:type="uml:Association" xmi:id="a1" name="places">
      <memberEnd xmi:idref="c2"/>
      <memberEnd xmi:idref="c1"/>
    </packagedElement>
  </uml:Model>
</xmi:XMI>
`;

export const UML_JSON_SAMPLE = `{
  "name": "Checkout UML",
  "kind": "sequence",
  "nodes": [
    { "id": "User", "name": "User", "kind": "actor" },
    { "id": "Shop", "name": "Shop", "kind": "participant" }
  ],
  "links": [
    { "source": "User", "target": "Shop", "label": "Checkout", "style": "message", "linkKind": "message" },
    { "source": "Shop", "target": "User", "label": "Receipt", "style": "return", "linkKind": "message" }
  ]
}
`;
