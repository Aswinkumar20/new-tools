/** Synthetic shop SQL schema snippets (education / research). */

export const SQLS_SAMPLE = `-- Shop schema (education / research)
CREATE TABLE customer (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255)
);

CREATE TABLE product (
  sku VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10,2)
);

CREATE TABLE shop_order (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customer(id),
  total DECIMAL(10,2)
);

CREATE TABLE order_item (
  order_id UUID NOT NULL,
  sku VARCHAR(64) NOT NULL,
  qty INT NOT NULL,
  PRIMARY KEY (order_id, sku)
);

ALTER TABLE order_item
  ADD CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES shop_order(id);

ALTER TABLE order_item
  ADD CONSTRAINT fk_item_product FOREIGN KEY (sku) REFERENCES product(sku);
`;

export const SQLS_JSON_SAMPLE = `{
  "name": "Shop schema",
  "tables": [
    {
      "name": "customer",
      "columns": [
        { "name": "id", "type": "UUID", "pk": true },
        { "name": "email", "type": "VARCHAR(255)", "unique": true, "nullable": false }
      ]
    },
    {
      "name": "shop_order",
      "columns": [
        { "name": "id", "type": "UUID", "pk": true },
        { "name": "customer_id", "type": "UUID", "fk": true, "refTable": "customer", "refColumn": "id" }
      ]
    }
  ],
  "fks": [
    { "source": "shop_order", "sourceColumn": "customer_id", "target": "customer", "targetColumn": "id" }
  ]
}
`;

export const SQLS_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<schema name="Shop">
  <table name="customer">
    <column name="id" type="UUID" pk="true"/>
    <column name="email" type="VARCHAR" unique="true"/>
  </table>
  <table name="shop_order">
    <column name="id" type="UUID" pk="true"/>
    <column name="customer_id" type="UUID" fk="true" refTable="customer" refColumn="id"/>
  </table>
  <fk source="shop_order" sourceColumn="customer_id" target="customer" targetColumn="id"/>
</schema>
`;

export const SQLS_MARKDOWN_SAMPLE = `# Shop schema

\`\`\`sql
CREATE TABLE customer (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL
);
CREATE TABLE cart (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customer(id)
);
\`\`\`
`;
