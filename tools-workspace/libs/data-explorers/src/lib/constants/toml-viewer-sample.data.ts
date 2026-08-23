/** Cargo config TOML snippets (education / research). */

export const TM_TOML_SAMPLE = `name = "CargoConfig"
currency = "USD"
active = true

[meta]
region = "US"
tax = 0.08

[[orders]]
orderId = 1001
sku = "serde"
total = 49.5
itemCount = 2
note = "serialization"

[[orders]]
orderId = 1002
sku = "tokio"
total = 18
itemCount = 1
note = "async runtime"

[[orders]]
orderId = 1003
sku = "clap"
total = 72
itemCount = 3
note = ""
`;

export const TM_JSON_SAMPLE = `{
  "format": "toml",
  "name": "CargoConfig",
  "tables": [
    { "name": "meta", "keys": { "region": "US", "tax": 0.08 } }
  ],
  "rows": [
    { "orderId": 1001, "sku": "serde", "total": 49.5 },
    { "orderId": 1002, "sku": "tokio", "total": 18 }
  ]
}
`;

export const TM_CSV_SAMPLE = `orderId,sku,total
1001,serde,49.5
1002,tokio,18
`;

export const TM_MARKDOWN_SAMPLE = `# CargoConfig

orderId: NUMBER
sku: STRING
total: NUMBER

1001 | serde | 49.5
1002 | tokio | 18
`;
