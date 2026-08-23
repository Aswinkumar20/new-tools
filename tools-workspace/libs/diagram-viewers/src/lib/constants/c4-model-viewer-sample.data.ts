/** Synthetic shop C4 snippets (education / research). */

export const C4_PUML_SAMPLE = `@startuml
!include C4_Container.puml
title Shop C4
Person(user, "Customer")
System(shop, "Shop", "Online store")
System_Ext(pay, "Payments")
Container(web, "Web App", "SPA")
Component(checkout, "Checkout", "Java")
Rel(user, shop, "Places orders")
Rel(shop, pay, "Charges")
Rel(user, web, "Uses")
Rel(web, checkout, "Calls")
@enduml
`;

export const C4_DSL_SAMPLE = `workspace "Shop" {
  model {
    user = person "Customer"
    shop = softwareSystem "Shop" {
      web = container "Web App"
      api = container "API" {
        checkout = component "Checkout"
      }
    }
    pay = softwareSystem "Payments"
    user -> shop "Places orders"
    api -> pay "Charges"
  }
}
`;

export const C4_JSON_SAMPLE = `{
  "name": "Shop C4",
  "elements": [
    { "id": "user", "name": "Customer", "kind": "person" },
    { "id": "shop", "name": "Shop", "kind": "system" },
    { "id": "web", "name": "Web App", "kind": "container", "parent": "shop", "technology": "SPA" },
    { "id": "checkout", "name": "Checkout", "kind": "component", "parent": "web", "technology": "Java" }
  ],
  "relations": [
    { "source": "user", "target": "shop", "label": "Places orders" },
    { "source": "web", "target": "checkout", "label": "Calls" }
  ]
}
`;

export const C4_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<c4 name="Shop">
  <element id="user" name="Customer" kind="person"/>
  <element id="shop" name="Shop" kind="system"/>
  <relation source="user" target="shop" label="Uses"/>
</c4>
`;

export const C4_MARKDOWN_SAMPLE = `# Shop

\`\`\`plantuml
@startuml
Person(buyer, "Buyer")
System(cart, "Cart")
Rel(buyer, cart, "Adds items")
@enduml
\`\`\`
`;
