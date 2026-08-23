/** Library SQLite snippets (education / research). */

export const SQ_ORDER_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { orderId: 1001, sku: 'ISBN-01', total: 49.5, itemCount: 2 },
  { orderId: 1002, sku: 'ISBN-02', total: 18, itemCount: 1 },
  { orderId: 1003, sku: 'ISBN-03', total: 72, itemCount: 3 }
];

export const SQ_PRODUCT_ROWS: ReadonlyArray<Record<string, string | number>> = [
  { sku: 'ISBN-01', name: 'Dune', price: 24.75 },
  { sku: 'ISBN-02', name: 'Sapiens', price: 18 }
];

export const SQ_ORDERS_SQL =
  'CREATE TABLE orders (orderId INTEGER PRIMARY KEY, sku TEXT NOT NULL, total REAL, itemCount INTEGER);';

export const SQ_PRODUCTS_SQL = 'CREATE TABLE products (sku TEXT PRIMARY KEY, name TEXT, price REAL);';

export const SQ_JSON_SAMPLE = `{
  "format": "sqlite",
  "name": "LibraryDb",
  "tables": [
    {
      "name": "orders",
      "sql": "CREATE TABLE orders (orderId INTEGER, sku TEXT, total REAL)",
      "columns": [
        { "name": "orderId", "type": "INTEGER" },
        { "name": "sku", "type": "TEXT" },
        { "name": "total", "type": "REAL" }
      ],
      "rows": [
        { "orderId": 1001, "sku": "ISBN-01", "total": 49.5 },
        { "orderId": 1002, "sku": "ISBN-02", "total": 18 }
      ]
    }
  ]
}
`;

export const SQ_SQL_SAMPLE = `CREATE TABLE orders (orderId INTEGER PRIMARY KEY, sku TEXT, total REAL);
INSERT INTO orders VALUES (1001, 'ISBN-01', 49.5);
INSERT INTO orders VALUES (1002, 'ISBN-02', 18);
`;

export const SQ_CSV_SAMPLE = `orderId,sku,total,itemCount
1001,ISBN-01,49.5,2
1002,ISBN-02,18,1
`;

export const SQ_MARKDOWN_SAMPLE = `# LibraryDb

orderId: INTEGER
sku: TEXT
total: REAL

1001 | ISBN-01 | 49.5
1002 | ISBN-02 | 18
`;
