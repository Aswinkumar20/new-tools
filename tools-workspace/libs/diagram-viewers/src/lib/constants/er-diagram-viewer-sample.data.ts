/** Synthetic shop ER snippets (education / research). */

export const ER_PUML_SAMPLE = `@startuml Shop
title Shop ER
entity Customer {
  * id : UUID <<PK>>
  --
  * email : String
  name : String
}
entity Order {
  * id : UUID <<PK>>
  * customer_id : UUID <<FK>>
  --
  total : Decimal
}
entity Product {
  * sku : String <<PK>>
  name : String
  price : Decimal
}
Customer ||--o{ Order : places
Order }o--|| Product : contains
@enduml
`;

export const ER_MERMAID_SAMPLE = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    uuid id PK
    string email
    string name
  }
  ORDER {
    uuid id PK
    uuid customer_id FK
    decimal total
  }
  PRODUCT {
    string sku PK
    string name
  }
  ORDER }o--|| PRODUCT : contains
`;

export const ER_JSON_SAMPLE = `{
  "name": "Shop ER",
  "entities": [
    {
      "name": "Customer",
      "columns": [
        { "name": "id", "type": "UUID", "pk": true },
        { "name": "email", "type": "String" }
      ]
    },
    {
      "name": "Order",
      "columns": [
        { "name": "id", "type": "UUID", "pk": true },
        { "name": "customer_id", "type": "UUID", "fk": true, "refEntity": "Customer", "refColumn": "id" }
      ]
    }
  ],
  "relations": [
    { "source": "Customer", "target": "Order", "label": "places", "sourceCard": "||", "targetCard": "o{" }
  ]
}
`;

export const ER_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<er name="Shop">
  <entity name="Customer">
    <column name="id" type="UUID" pk="true"/>
    <column name="email" type="String"/>
  </entity>
  <entity name="Order">
    <column name="id" type="UUID" pk="true"/>
    <column name="customer_id" type="UUID" fk="true" refEntity="Customer" refColumn="id"/>
  </entity>
  <relation source="Customer" target="Order" label="places" sourceCard="||" targetCard="o{"/>
</er>
`;

export const ER_MARKDOWN_SAMPLE = `# Shop ER

\`\`\`mermaid
erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    uuid id PK
  }
  ORDER {
    uuid id PK
    uuid customer_id FK
  }
\`\`\`
`;
