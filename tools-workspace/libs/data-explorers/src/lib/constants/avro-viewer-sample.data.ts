/** Synthetic shop order Avro snippets (education / research). */

export const AV_SCHEMA = {
  type: 'record',
  name: 'ClickEvent',
  namespace: 'com.events',
  fields: [
    { name: 'orderId', type: 'long' },
    { name: 'sku', type: 'string' },
    { name: 'total', type: 'double' },
    { name: 'itemCount', type: 'int' }
  ]
} as const;

export const AV_SHOP_RECORDS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'EVT-HOME', total: 49.5, itemCount: 2 },
  { orderId: 1002, sku: 'EVT-CART', total: 18, itemCount: 1 },
  { orderId: 1003, sku: 'EVT-PAY', total: 72, itemCount: 3 }
];

export const AV_JSON_SAMPLE = `{
  "schema": {
    "type": "record",
    "name": "ClickEvent",
    "namespace": "com.events",
    "fields": [
      { "name": "orderId", "type": "long" },
      { "name": "sku", "type": "string" },
      { "name": "total", "type": "double" }
    ]
  },
  "records": [
    { "orderId": 1001, "sku": "EVT-HOME", "total": 49.5 }
  ]
}
`;

export const AV_AVSC_SAMPLE = `{
  "type": "record",
  "name": "ClickEvent",
  "namespace": "com.events",
  "fields": [
    { "name": "orderId", "type": "long" },
    { "name": "sku", "type": "string" },
    { "name": "total", "type": "double" },
    { "name": "itemCount", "type": "int" }
  ]
}
`;

export const AV_MARKDOWN_SAMPLE = `# ClickEvent

orderId: long
sku: string
total: double

1001 | EVT-HOME | 49.5
`;
