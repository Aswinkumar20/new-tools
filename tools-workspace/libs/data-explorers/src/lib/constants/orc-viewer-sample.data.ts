/** Synthetic shop order ORC snippets (education / research). */

export const ORC_SHOP_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'FCT-01', total: 49.5, itemCount: 2 },
  { orderId: 1002, sku: 'FCT-02', total: 18, itemCount: 1 },
  { orderId: 1003, sku: 'FCT-03', total: 72, itemCount: 3 }
];

export const ORC_JSON_SAMPLE = `{
  "format": "orc",
  "name": "HiveFacts",
  "numRows": 2,
  "compression": "NONE",
  "schema": [
    { "name": "orderId", "type": "LONG" },
    { "name": "sku", "type": "STRING" },
    { "name": "total", "type": "DOUBLE" }
  ],
  "rows": [
    { "orderId": 1001, "sku": "FCT-01", "total": 49.5 },
    { "orderId": 1002, "sku": "FCT-02", "total": 18 }
  ]
}
`;

export const ORC_CSV_SAMPLE = `orderId,sku,total,itemCount
1001,FCT-01,49.5,2
1002,FCT-02,18,1
`;

export const ORC_MARKDOWN_SAMPLE = `# HiveFacts

orderId: LONG
sku: STRING
total: DOUBLE

1001 | FCT-01 | 49.5
1002 | FCT-02 | 18
`;
