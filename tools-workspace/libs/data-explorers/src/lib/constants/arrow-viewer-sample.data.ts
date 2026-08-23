/** Device telemetry Arrow snippets (education / research). */

export const AR_SHOP_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'DEV-A1', total: 49.5, itemCount: 2 },
  { orderId: 1002, sku: 'DEV-B2', total: 18, itemCount: 1 },
  { orderId: 1003, sku: 'DEV-C3', total: 72, itemCount: 3 }
];

export const AR_JSON_SAMPLE = `{
  "format": "arrow",
  "name": "DeviceTelemetry",
  "numRows": 2,
  "schema": [
    { "name": "orderId", "type": "INT64" },
    { "name": "sku", "type": "UTF8" },
    { "name": "total", "type": "DOUBLE" }
  ],
  "rows": [
    { "orderId": 1001, "sku": "DEV-A1", "total": 49.5 },
    { "orderId": 1002, "sku": "DEV-B2", "total": 18 }
  ]
}
`;

export const AR_CSV_SAMPLE = `orderId,sku,total,itemCount
1001,DEV-A1,49.5,2
1002,DEV-B2,18,1
`;

export const AR_MARKDOWN_SAMPLE = `# DeviceTelemetry

orderId: INT64
sku: UTF8
total: DOUBLE

1001 | DEV-A1 | 49.5
1002 | DEV-B2 | 18
`;
