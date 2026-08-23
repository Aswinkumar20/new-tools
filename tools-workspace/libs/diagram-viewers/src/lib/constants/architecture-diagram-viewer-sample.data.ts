/** Synthetic shop architecture snippets (education / research). */

export const ARCH_PUML_SAMPLE = `@startuml Shop
title Shop architecture
rectangle "Web App" as Web
component "API" as Api
database "Orders" as Db
cloud "Payments" as Pay
Web --> Api : HTTPS
Api --> Db : SQL
Api ..> Pay : Charge
@enduml
`;

export const ARCH_MERMAID_SAMPLE = `flowchart LR
  Web[Web App] --> Api[API]
  Api --> Db[(Orders)]
  Api -.-> Pay[Payments]
`;

export const ARCH_JSON_SAMPLE = `{
  "name": "Shop architecture",
  "boxes": [
    { "id": "Web", "name": "Web App", "kind": "app" },
    { "id": "Api", "name": "API", "kind": "service" },
    { "id": "Db", "name": "Orders", "kind": "database" }
  ],
  "connectors": [
    { "source": "Web", "target": "Api", "label": "HTTPS", "style": "call" },
    { "source": "Api", "target": "Db", "label": "SQL", "style": "data" }
  ]
}
`;

export const ARCH_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<architecture name="Shop">
  <box id="Web" name="Web App" kind="app"/>
  <box id="Api" name="API" kind="service"/>
  <connector source="Web" target="Api" label="HTTPS" style="call"/>
  <connector source="Api" target="Web" label="JSON" style="data"/>
</architecture>
`;

export const ARCH_MARKDOWN_SAMPLE = `# Shop

\`\`\`plantuml
@startuml
[Web] --> [API]
[API] --> [Cache]
@enduml
\`\`\`
`;
