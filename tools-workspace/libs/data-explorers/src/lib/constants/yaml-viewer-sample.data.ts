/** Kubernetes deploy YAML snippets (education / research). */

export const YL_YAML_SAMPLE = `name: WebDeploy
currency: USD
active: true
orders:
  - orderId: 1001
    sku: nginx
    total: 49.5
    itemCount: 2
    note: edge proxy
  - orderId: 1002
    sku: redis
    total: 18
    itemCount: 1
    note: cache sidecar
  - orderId: 1003
    sku: worker
    total: 72
    itemCount: 3
    note: null
`;

export const YL_JSON_SAMPLE = `{
  "name": "WebDeploy",
  "currency": "USD",
  "active": true,
  "orders": [
    { "orderId": 1001, "sku": "nginx", "total": 49.5 },
    { "orderId": 1002, "sku": "redis", "total": 18 }
  ]
}
`;

export const YL_CSV_SAMPLE = `orderId,sku,total
1001,nginx,49.5
1002,redis,18
`;

export const YL_MARKDOWN_SAMPLE = `# WebDeploy

orderId: NUMBER
sku: STRING
total: NUMBER

1001 | nginx | 49.5
1002 | redis | 18
`;
