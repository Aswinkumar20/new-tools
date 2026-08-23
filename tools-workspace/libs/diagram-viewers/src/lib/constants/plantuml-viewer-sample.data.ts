/** Synthetic shop class + C4 snippets for local PlantUML preview (education / research). */

export const PUML_CLASS_SAMPLE = `@startuml Shop
title Shop domain
class Customer {
  +id: String
  +email: String
}
class Order {
  +id: String
  +total(): Money
}
class Item {
  +sku: String
}
interface Payable
Customer "1" --> "*" Order : places
Order "1" *-- "*" Item
Order ..|> Payable
@enduml
`;

export const PUML_C4_SAMPLE = `@startuml
!include C4_Context.puml
Person(customer, "Customer")
System(shop, "Shop")
System_Ext(pay, "Payments")
Rel(customer, shop, "Orders")
Rel(shop, pay, "Charge")
@enduml
`;

export const PUML_MARKDOWN_SAMPLE = `# Shop

\`\`\`plantuml
@startuml
class Cart
class Payment
Cart --> Payment : checkout
@enduml
\`\`\`
`;

export const PUML_JSON_SAMPLE = `{
  "name": "Shop context",
  "kind": "c4",
  "elements": [
    { "id": "customer", "name": "Customer", "kind": "person" },
    { "id": "shop", "name": "Shop", "kind": "system" },
    { "id": "pay", "name": "Payments", "kind": "system", "stereotype": "external" }
  ],
  "relations": [
    { "source": "customer", "target": "shop", "label": "Orders", "style": "rel" },
    { "source": "shop", "target": "pay", "label": "Charge", "style": "rel" }
  ]
}
`;
