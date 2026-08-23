/** App config INI snippets (education / research). */

export const IN_INI_SAMPLE = `name=AppConfig
currency=USD

[shop]
active=true
region=US

[meta]
tax=0.08
locale=en-US

[orders.1001]
sku=DB-MAIN
total=49.5
itemCount=2
note=primary database

[orders.1002]
sku=DB-READ
total=18
itemCount=1
note=replica database

[orders.1003]
sku=DB-CACHE
total=72
itemCount=3
note=
`;

export const IN_JSON_SAMPLE = `{
  "name": "AppConfig",
  "sections": [
    { "name": "shop", "keys": { "active": true, "region": "US" } },
    { "name": "meta", "keys": { "tax": 0.08, "locale": "en-US" } }
  ],
  "rows": [
    { "orderId": 1001, "sku": "DB-MAIN", "total": 49.5 },
    { "orderId": 1002, "sku": "DB-READ", "total": 18 }
  ]
}
`;

export const IN_CSV_SAMPLE = `orderId,sku,total
1001,DB-MAIN,49.5
1002,DB-READ,18
`;

export const IN_MARKDOWN_SAMPLE = `# AppConfig

orderId: NUMBER
sku: STRING
total: NUMBER

1001 | DB-MAIN | 49.5
1002 | DB-READ | 18
`;
