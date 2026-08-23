/** Synthetic shop OWL snippets (education / research). */

export const OWL_SAMPLE = `<?xml version="1.0"?>
<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
         xmlns:shop="http://example.org/shop#">
  <owl:Ontology rdf:about="http://example.org/shop"/>
  <owl:Class rdf:about="http://example.org/shop#Product">
    <rdfs:label>Product</rdfs:label>
  </owl:Class>
  <owl:Class rdf:about="http://example.org/shop#Book">
    <rdfs:label>Book</rdfs:label>
    <rdfs:subClassOf rdf:resource="http://example.org/shop#Product"/>
  </owl:Class>
  <owl:Class rdf:about="http://example.org/shop#Customer">
    <rdfs:label>Customer</rdfs:label>
  </owl:Class>
  <owl:ObjectProperty rdf:about="http://example.org/shop#buys">
    <rdfs:label>buys</rdfs:label>
    <rdfs:domain rdf:resource="http://example.org/shop#Customer"/>
    <rdfs:range rdf:resource="http://example.org/shop#Product"/>
  </owl:ObjectProperty>
  <owl:DatatypeProperty rdf:about="http://example.org/shop#price">
    <rdfs:label>price</rdfs:label>
    <rdfs:domain rdf:resource="http://example.org/shop#Product"/>
    <rdfs:range rdf:resource="http://www.w3.org/2001/XMLSchema#decimal"/>
  </owl:DatatypeProperty>
</rdf:RDF>
`;

export const OWL_JSON_SAMPLE = `{
  "name": "Shop",
  "classes": [
    { "name": "Product" },
    { "name": "Book", "super": "Product" }
  ],
  "properties": [
    { "name": "buys", "kind": "object", "domain": "Customer", "range": "Product" }
  ]
}
`;

export const OWL_XML_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<ontology name="Shop">
  <class name="Product"/>
  <class name="Book" super="Product"/>
  <property name="buys" kind="object" domain="Customer" range="Product"/>
</ontology>
`;

export const OWL_MARKDOWN_SAMPLE = `# Shop

\`\`\`owl
Product
Book -> Product
buys : Customer -> Product
\`\`\`
`;

export const OWL_TURTLE_SAMPLE = `@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix shop: <http://example.org/shop#> .

shop:Product a owl:Class ;
  rdfs:label "Product" .

shop:Book a owl:Class ;
  rdfs:label "Book" ;
  rdfs:subClassOf shop:Product .

shop:buys a owl:ObjectProperty ;
  rdfs:domain shop:Customer ;
  rdfs:range shop:Product .
`;
