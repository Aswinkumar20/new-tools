/** Synthetic ShopRanker pickle metadata snippets (education / research). */

export const PK_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "protocol": 4,
  "python": "3.11",
  "types": [
    { "name": "ShopRanker", "module": "shop.ranker", "kind": "class" },
    { "name": "ndarray", "module": "numpy", "kind": "array" },
    { "name": "OrderedDict", "module": "collections", "kind": "mapping" },
    { "name": "Linear", "module": "torch.nn", "kind": "module" }
  ],
  "warnings": [
    { "level": "info", "message": "Pickle dumps are not executed; only type hints are listed." }
  ]
}
`;

export const PK_CSV_SAMPLE = `name,module,kind
ShopRanker,shop.ranker,class
ndarray,numpy,array
OrderedDict,collections,mapping
Linear,torch.nn,module
`;

export const PK_MARKDOWN_SAMPLE = `# ShopRanker

name: STRING
module: STRING
kind: STRING

ShopRanker | shop.ranker | class
ndarray | numpy | array
OrderedDict | collections | mapping
Linear | torch.nn | module
`;
