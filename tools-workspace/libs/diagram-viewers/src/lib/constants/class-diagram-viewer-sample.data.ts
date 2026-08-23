/** Synthetic catalog class model for types / relations preview (education / research). */

export const CDG_PUML_SAMPLE = `@startuml Catalog
title Catalog types
abstract class Entity {
  #id: UUID
}
class Product {
  -sku: String
  +name: String
  +price(): Money
}
class Review {
  +rating: int
  +body: String
}
interface Auditable {
  +touchedAt(): Date
}
enum Status {
  OPEN
  CLOSED
}
Entity <|-- Product
Product ..|> Auditable
Product "1" --> "*" Review : has
@enduml
`;

export const CDG_XMI_SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:uml="http://www.omg.org/spec/UML/20131001" xmlns:xmi="http://www.omg.org/spec/XMI/20131001">
  <uml:Model name="Catalog">
    <packagedElement xmi:type="uml:Class" xmi:id="p1" name="Product" isAbstract="true">
      <ownedAttribute name="sku" visibility="private"/>
      <ownedOperation name="price" visibility="public"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Interface" xmi:id="i1" name="Auditable"/>
    <packagedElement xmi:type="uml:Realization" client="p1" supplier="i1"/>
  </uml:Model>
</xmi:XMI>
`;

export const CDG_JSON_SAMPLE = `{
  "name": "Catalog types",
  "types": [
    { "id": "Entity", "name": "Entity", "kind": "abstract", "attributes": [{ "name": "id", "type": "UUID", "visibility": "protected", "kind": "attribute" }] },
    { "id": "Product", "name": "Product", "kind": "class", "attributes": [{ "name": "sku", "type": "String", "visibility": "private", "kind": "attribute" }], "operations": [{ "name": "price", "type": "Money", "visibility": "public", "kind": "operation" }] }
  ],
  "relations": [
    { "source": "Product", "target": "Entity", "style": "inherit" }
  ]
}
`;

export const CDG_MARKDOWN_SAMPLE = `# Catalog

\`\`\`plantuml
@startuml
class Cart
class Item
Cart "1" *-- "*" Item
@enduml
\`\`\`
`;
