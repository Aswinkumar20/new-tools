/** NYC taxi Parquet snippets (education / research). */

export const PQ_SHOP_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'VND-1', total: 49.5, itemCount: 2 },
  { orderId: 1002, sku: 'VND-2', total: 18, itemCount: 1 },
  { orderId: 1003, sku: 'VND-3', total: 72, itemCount: 3 }
];

export const PQ_JSON_SAMPLE = `{
  "format": "parquet",
  "name": "NycTaxi",
  "createdBy": "easytoolhub-sample",
  "numRows": 2,
  "schema": [
    { "name": "orderId", "type": "INT64", "repetition": "REQUIRED" },
    { "name": "sku", "type": "BYTE_ARRAY", "convertedType": "UTF8", "repetition": "REQUIRED" },
    { "name": "total", "type": "DOUBLE", "repetition": "REQUIRED" }
  ],
  "rows": [
    { "orderId": 1001, "sku": "VND-1", "total": 49.5 },
    { "orderId": 1002, "sku": "VND-2", "total": 18 }
  ]
}
`;

export const PQ_CSV_SAMPLE = `orderId,sku,total,itemCount
1001,VND-1,49.5,2
1002,VND-2,18,1
`;

export const PQ_MARKDOWN_SAMPLE = `# NycTaxi

orderId: INT64
sku: UTF8
total: DOUBLE

1001 | VND-1 | 49.5
1002 | VND-2 | 18
`;
