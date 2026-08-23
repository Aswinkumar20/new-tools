/** Synthetic shop Prisma snippets (education / research). */

export const PRM_SAMPLE = `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Customer {
  id     String  @id @default(uuid())
  email  String  @unique
  name   String?
  orders Order[]
}

model Order {
  id         String      @id @default(uuid())
  customerId String
  total      Decimal
  customer   Customer    @relation(fields: [customerId], references: [id])
  items      OrderItem[]
}

model Product {
  sku   String      @id
  name  String
  price Decimal
  items OrderItem[]
}

model OrderItem {
  orderId String
  sku     String
  qty     Int
  order   Order   @relation(fields: [orderId], references: [id])
  product Product @relation(fields: [sku], references: [sku])

  @@id([orderId, sku])
}
`;

export const PRM_JSON_SAMPLE = `{
  "name": "Shop",
  "provider": "postgresql",
  "models": [
    {
      "name": "Customer",
      "fields": [
        { "name": "id", "type": "String", "isId": true },
        { "name": "email", "type": "String", "isUnique": true }
      ]
    },
    {
      "name": "Order",
      "fields": [
        { "name": "id", "type": "String", "isId": true },
        { "name": "customerId", "type": "String" },
        { "name": "customer", "type": "Customer", "relation": true }
      ]
    }
  ],
  "relations": [
    { "source": "Order", "target": "Customer", "sourceField": "customerId", "targetField": "id", "kind": "1-n" }
  ]
}
`;

export const PRM_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<prisma name="Shop" provider="postgresql">
  <model name="Customer">
    <field name="id" type="String" isId="true"/>
    <field name="email" type="String" isUnique="true"/>
  </model>
  <model name="Order">
    <field name="id" type="String" isId="true"/>
    <field name="customerId" type="String"/>
  </model>
  <relation source="Order" target="Customer" sourceField="customerId" targetField="id" kind="1-n"/>
</prisma>
`;

export const PRM_MARKDOWN_SAMPLE = `# Shop

\`\`\`prisma
model Customer {
  id    String @id
  email String @unique
  carts Cart[]
}
model Cart {
  id         String   @id
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id])
}
\`\`\`
`;
