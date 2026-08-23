/** Synthetic shop RDF snippets (education / research). */

export const RDF_SAMPLE = `@prefix shop: <http://example.org/shop#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

shop:Web rdf:type shop:Service ;
  rdfs:label "Web storefront" ;
  shop:dependsOn shop:Api .

shop:Api rdf:type shop:Service ;
  rdfs:label "API" ;
  shop:dependsOn shop:Catalog .

shop:Catalog rdf:type shop:Dataset ;
  rdfs:label "Product catalog" .
`;

export const RDF_JSON_SAMPLE = `{
  "name": "Shop",
  "prefixes": {
    "shop": "http://example.org/shop#"
  },
  "triples": [
    { "subject": "shop:Web", "predicate": "rdf:type", "object": "shop:Service" },
    { "subject": "shop:Web", "predicate": "shop:dependsOn", "object": "shop:Api" }
  ]
}
`;

export const RDF_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rdf name="Shop">
  <prefix name="shop" iri="http://example.org/shop#"/>
  <triple subject="shop:Web" predicate="rdf:type" object="shop:Service"/>
  <triple subject="shop:Web" predicate="shop:dependsOn" object="shop:Api"/>
</rdf>
`;

export const RDF_MARKDOWN_SAMPLE = `# Shop

\`\`\`ttl
@prefix shop: <http://example.org/shop#> .
shop:Web shop:dependsOn shop:Api .
\`\`\`
`;
