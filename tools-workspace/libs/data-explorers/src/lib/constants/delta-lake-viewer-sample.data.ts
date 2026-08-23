/** Synthetic shop order Delta Lake snippets (education / research). */

export const DL_SHOP_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'EVT-01', total: 49.5, itemCount: 2 },
  { orderId: 1002, sku: 'EVT-02', total: 18, itemCount: 1 },
  { orderId: 1003, sku: 'EVT-03', total: 72, itemCount: 3 }
];

export const DL_JSON_SAMPLE = `{
  "format": "delta",
  "name": "EventLog",
  "protocol": { "minReaderVersion": 1, "minWriterVersion": 2 },
  "versions": [
    { "version": 0, "timestamp": "2024-03-01T10:00:00Z", "operation": "CREATE TABLE", "numFiles": 1, "numRows": 3 },
    { "version": 1, "timestamp": "2024-03-02T12:00:00Z", "operation": "WRITE", "numFiles": 1, "numRows": 3 }
  ],
  "schema": [
    { "name": "orderId", "type": "LONG" },
    { "name": "sku", "type": "STRING" },
    { "name": "total", "type": "DOUBLE" }
  ],
  "rows": [
    { "orderId": 1001, "sku": "EVT-01", "total": 49.5 },
    { "orderId": 1002, "sku": "EVT-02", "total": 18 }
  ]
}
`;

export const DL_LOG_SAMPLE = `{"protocol":{"minReaderVersion":1,"minWriterVersion":2}}
{"metaData":{"id":"shop-orders","format":{"provider":"parquet"},"schemaString":"{\\"type\\":\\"struct\\",\\"fields\\":[{\\"name\\":\\"orderId\\",\\"type\\":\\"long\\",\\"nullable\\":true},{\\"name\\":\\"sku\\",\\"type\\":\\"string\\",\\"nullable\\":true},{\\"name\\":\\"total\\",\\"type\\":\\"double\\",\\"nullable\\":true},{\\"name\\":\\"itemCount\\",\\"type\\":\\"integer\\",\\"nullable\\":true}]}"}}
{"commitInfo":{"timestamp":1709280000000,"operation":"WRITE","operationParameters":{"mode":"Overwrite"}}}
{"add":{"path":"part-00000-shop.parquet","size":512,"modificationTime":1709280000000,"stats":"{\\"numRecords\\":2}"}}
`;

export const DL_CSV_SAMPLE = `orderId,sku,total,itemCount
1001,EVT-01,49.5,2
1002,EVT-02,18,1
`;

export const DL_MARKDOWN_SAMPLE = `# EventLog

orderId: LONG
sku: STRING
total: DOUBLE

1001 | EVT-01 | 49.5
1002 | EVT-02 | 18
`;
