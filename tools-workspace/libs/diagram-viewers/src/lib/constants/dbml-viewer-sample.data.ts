/** Synthetic shop DBML snippets (education / research). */

export const DBML_SAMPLE = `Project Shop {
  database_type: 'PostgreSQL'
  Note: 'Shop schema'
}

Table Customer {
  id uuid [pk]
  email varchar [unique, not null]
  name varchar
  Note: 'Shopper'
}

Table Order {
  id uuid [pk]
  customer_id uuid [ref: > Customer.id]
  product_sku varchar
  total decimal
}

Table Product {
  sku varchar [pk]
  name varchar
  price decimal
}

Ref items: Order.product_sku > Product.sku
`;

export const DBML_JSON_SAMPLE = `{
  "name": "Shop",
  "databaseType": "PostgreSQL",
  "tables": [
    {
      "name": "Customer",
      "columns": [
        { "name": "id", "type": "uuid", "pk": true },
        { "name": "email", "type": "varchar", "unique": true }
      ]
    },
    {
      "name": "Order",
      "columns": [
        { "name": "id", "type": "uuid", "pk": true },
        { "name": "customer_id", "type": "uuid", "fk": true, "refTable": "Customer", "refColumn": "id" }
      ]
    }
  ],
  "refs": [
    { "source": "Order", "sourceColumn": "customer_id", "target": "Customer", "targetColumn": "id", "rel": ">" }
  ]
}
`;

export const DBML_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<dbml name="Shop" databaseType="PostgreSQL">
  <table name="Customer">
    <column name="id" type="uuid" pk="true"/>
    <column name="email" type="varchar" unique="true"/>
  </table>
  <table name="Order">
    <column name="id" type="uuid" pk="true"/>
    <column name="customer_id" type="uuid" fk="true" refTable="Customer" refColumn="id"/>
  </table>
  <ref source="Order" sourceColumn="customer_id" target="Customer" targetColumn="id" rel=">"/>
</dbml>
`;

export const DBML_MARKDOWN_SAMPLE = `# Shop

\`\`\`dbml
Table Customer {
  id uuid [pk]
  email varchar
}
Table Cart {
  id uuid [pk]
  customer_id uuid [ref: > Customer.id]
}
Ref: Cart.customer_id > Customer.id
\`\`\`
`;
