/** Synthetic ShopRanker OpenDocument snippets (education / research). */

export const OD_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "title": "ShopRanker Handbook",
  "author": "EasyToolHub",
  "odfVer": "1.0",
  "kind": "odt",
  "pages": [
    { "name": "cover", "kind": "cover" },
    { "name": "notes", "kind": "notes" }
  ],
  "sheets": [
    { "name": "inventory", "kind": "inventory" }
  ],
  "blocks": [
    { "name": "title", "kind": "heading", "page": "cover", "text": "ShopRanker" },
    { "name": "intro", "kind": "para", "page": "cover", "text": "The shop floor slab is twelve by eight metres." },
    { "name": "aisle", "kind": "para", "page": "notes", "text": "Aisle runs from six,one to six,seven. Column radius 0.35 at ten,six." }
  ],
  "cells": [
    { "sheet": "inventory", "ref": "A1", "value": "SKU" },
    { "sheet": "inventory", "ref": "B1", "value": "Qty" },
    { "sheet": "inventory", "ref": "A2", "value": "counter" },
    { "sheet": "inventory", "ref": "B2", "value": "1" },
    { "sheet": "inventory", "ref": "A3", "value": "storage" },
    { "sheet": "inventory", "ref": "B3", "value": "1" },
    { "sheet": "inventory", "ref": "A4", "value": "column" },
    { "sheet": "inventory", "ref": "B4", "value": "1" }
  ]
}
`;

export const OD_ASCII_SAMPLE = `ODF dump ShopRanker 1.0
KIND odt
TITLE ShopRanker Handbook
AUTHOR EasyToolHub
PAGE cover
PAGE notes
SHEET inventory
BLOCK heading cover ShopRanker
BLOCK para cover The shop floor slab is twelve by eight metres.
BLOCK para notes Aisle runs from six,one to six,seven. Column radius 0.35 at ten,six.
CELL inventory A1 SKU
CELL inventory B1 Qty
CELL inventory A2 counter
CELL inventory B2 1
CELL inventory A3 storage
CELL inventory B3 1
CELL inventory A4 column
CELL inventory B4 1
`;

export const OD_CSV_SAMPLE = `name,type,kind,page,sheet,value
cover,page,cover,cover,,
notes,page,notes,notes,,
inventory,sheet,inventory,,inventory,
title,block,heading,cover,,ShopRanker
intro,block,para,cover,,The shop floor slab is twelve by eight metres.
aisle,block,para,notes,,Aisle runs from six,one to six,seven.
A1,cell,cell,,inventory,SKU
B1,cell,cell,,inventory,Qty
A2,cell,cell,,inventory,counter
B2,cell,cell,,inventory,1
`;

export const OD_MARKDOWN_SAMPLE = `# ShopRanker Handbook

name: STRING
type: STRING
kind: STRING

cover | page | cover
notes | page | notes
inventory | sheet | inventory
title | block | heading
intro | block | para
aisle | block | para
A1 | cell | SKU
`;
