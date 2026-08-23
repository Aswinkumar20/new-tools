/** Synthetic shop order Feather snippets (education / research). */

export const FT_SHOP_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'MET-CPU', total: 49.5, itemCount: 2 },
  { orderId: 1002, sku: 'MET-MEM', total: 18, itemCount: 1 },
  { orderId: 1003, sku: 'MET-DSK', total: 72, itemCount: 3 }
];

export const FT_JSON_SAMPLE = `{
  "format": "feather",
  "name": "PandasMetrics",
  "numRows": 2,
  "columns": [
    { "name": "orderId", "type": "INT64" },
    { "name": "sku", "type": "UTF8" },
    { "name": "total", "type": "DOUBLE" }
  ],
  "rows": [
    { "orderId": 1001, "sku": "MET-CPU", "total": 49.5 },
    { "orderId": 1002, "sku": "MET-MEM", "total": 18 }
  ]
}
`;

export const FT_CSV_SAMPLE = `orderId,sku,total,itemCount
1001,MET-CPU,49.5,2
1002,MET-MEM,18,1
`;

export const FT_MARKDOWN_SAMPLE = `# PandasMetrics

orderId: INT64
sku: UTF8
total: DOUBLE

1001 | MET-CPU | 49.5
1002 | MET-MEM | 18
`;
