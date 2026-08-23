/** Synthetic shop DuckDB snippets (education / research). */

export const DK_ORDER_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'SESS-01', total: 49.5, itemCount: 2 },
  { orderId: 1002, sku: 'SESS-02', total: 18, itemCount: 1 },
  { orderId: 1003, sku: 'SESS-03', total: 72, itemCount: 3 }
];

export const DK_PRODUCT_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { sku: 'SESS-01', name: 'Navy Tee', price: 24.75 },
  { sku: 'SESS-02', name: 'Logo Mug', price: 18 }
];

export const DK_ORDERS_SQL =
  'CREATE TABLE orders (orderId BIGINT PRIMARY KEY, sku VARCHAR NOT NULL, total DOUBLE, itemCount INTEGER);';

export const DK_PRODUCTS_SQL = 'CREATE TABLE products (sku VARCHAR PRIMARY KEY, name VARCHAR, price DOUBLE);';

export const DK_JSON_SAMPLE = `{
  "format": "duckdb",
  "name": "AnalyticsWh",
  "storageVersion": 64,
  "tables": [
    {
      "name": "orders",
      "sql": "CREATE TABLE orders (orderId BIGINT, sku VARCHAR, total DOUBLE)",
      "columns": [
        { "name": "orderId", "type": "BIGINT" },
        { "name": "sku", "type": "VARCHAR" },
        { "name": "total", "type": "DOUBLE" }
      ],
      "rows": [
        { "orderId": 1001, "sku": "SESS-01", "total": 49.5 },
        { "orderId": 1002, "sku": "SESS-02", "total": 18 }
      ]
    }
  ]
}
`;

export const DK_SQL_SAMPLE = `CREATE TABLE orders (orderId BIGINT PRIMARY KEY, sku VARCHAR, total DOUBLE);
INSERT INTO orders VALUES (1001, 'SESS-01', 49.5);
INSERT INTO orders VALUES (1002, 'SESS-02', 18);
`;

export const DK_CSV_SAMPLE = `orderId,sku,total,itemCount
1001,SESS-01,49.5,2
1002,SESS-02,18,1
`;

export const DK_MARKDOWN_SAMPLE = `# AnalyticsWh

orderId: BIGINT
sku: VARCHAR
total: DOUBLE

1001 | SESS-01 | 49.5
1002 | SESS-02 | 18
`;
