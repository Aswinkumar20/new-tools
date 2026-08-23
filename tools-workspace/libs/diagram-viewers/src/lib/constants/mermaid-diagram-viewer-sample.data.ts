/** Synthetic checkout flowchart for local Mermaid preview (education / research). */

export const MMD_FLOWCHART_SAMPLE = `flowchart TD
  A[Cart] --> B{Payment ok?}
  B -->|yes| C[Fulfill order]
  B -->|no| D[Retry payment]
  C --> E[Done]
  D --> B
`;

export const MMD_SEQUENCE_SAMPLE = `sequenceDiagram
  participant C as Customer
  participant S as Shop
  C->>S: Checkout
  S-->>C: Receipt
`;

export const MMD_MARKDOWN_SAMPLE = `# Checkout

\`\`\`mermaid
flowchart LR
  A[Cart] --> B{Paid?}
  B -->|yes| C[Ship]
  B -->|no| D[Retry]
\`\`\`
`;

export const MMD_JSON_SAMPLE = `{
  "name": "Checkout sequence",
  "kind": "sequence",
  "nodes": [
    { "id": "C", "name": "Customer", "shape": "participant" },
    { "id": "S", "name": "Shop", "shape": "participant" }
  ],
  "edges": [
    { "source": "C", "target": "S", "label": "Checkout", "style": "message" },
    { "source": "S", "target": "C", "label": "Receipt", "style": "return" }
  ]
}
`;
