/** Synthetic shop knowledge-graph snippets (education / research). */

export const KG_SAMPLE = `{
  "name": "Shop",
  "entities": [
    { "id": "web", "name": "Web", "type": "Service", "label": "Storefront" },
    { "id": "api", "name": "Api", "type": "Service", "label": "Backend API" },
    { "id": "catalog", "name": "Catalog", "type": "Dataset" },
    { "id": "customer", "name": "Customer", "type": "Person" }
  ],
  "links": [
    { "source": "web", "target": "api", "rel": "dependsOn" },
    { "source": "api", "target": "catalog", "rel": "reads" },
    { "source": "customer", "target": "web", "rel": "uses" }
  ]
}
`;

export const KG_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<knowledge-graph name="Shop">
  <entity id="web" name="Web" type="Service"/>
  <entity id="api" name="Api" type="Service"/>
  <link source="web" target="api" rel="dependsOn"/>
</knowledge-graph>
`;

export const KG_CSV_SAMPLE = `id,name,type
web,Web,Service
api,Api,Service

source,target,rel
web,api,dependsOn
`;

export const KG_MARKDOWN_SAMPLE = `# Shop

Web --dependsOn--> Api
`;
