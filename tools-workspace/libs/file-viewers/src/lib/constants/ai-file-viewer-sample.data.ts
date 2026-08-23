/** Synthetic ShopFloor Illustrator snippets (education / research). */

export const AI_JSON_SAMPLE = `{
  "name": "ShopFloor",
  "title": "ShopFloor artboard",
  "aiVer": "1.0",
  "width": 12,
  "height": 8,
  "artboards": [
    { "name": "ShopFloor", "x": 0, "y": 0, "w": 12, "h": 8 }
  ],
  "layers": [
    { "name": "slab", "colorHex": "#34d399" },
    { "name": "furniture", "colorHex": "#60a5fa" },
    { "name": "labels", "colorHex": "#fbbf24" }
  ],
  "paths": [
    { "name": "slab", "kind": "rect", "artboard": "ShopFloor", "layer": "slab", "x": 0, "y": 0, "w": 12, "h": 8 },
    { "name": "counter", "kind": "rect", "artboard": "ShopFloor", "layer": "furniture", "x": 1, "y": 1, "w": 3, "h": 1.2 },
    { "name": "storage", "kind": "rect", "artboard": "ShopFloor", "layer": "furniture", "x": 8, "y": 0.5, "w": 3.5, "h": 2 },
    { "name": "column", "kind": "circle", "artboard": "ShopFloor", "layer": "furniture", "x": 10, "y": 6, "r": 0.35 },
    { "name": "aisle", "kind": "line", "artboard": "ShopFloor", "layer": "labels", "x": 6, "y": 1, "x2": 6, "y2": 7 },
    { "name": "title", "kind": "text", "artboard": "ShopFloor", "layer": "labels", "x": 4.2, "y": 4.2, "text": "ShopRanker" }
  ]
}
`;

export const AI_ASCII_SAMPLE = `AI dump ShopFloor 1.0
ARTBOARD ShopFloor 0 0 12 8
LAYER slab #34d399
LAYER furniture #60a5fa
LAYER labels #fbbf24
PATH rect slab slab 0 0 12 8
PATH rect counter furniture 1 1 3 1.2
PATH rect storage furniture 8 0.5 3.5 2
PATH circle column furniture 10 6 0.35
PATH line aisle labels 6 1 6 7
TEXT ShopRanker labels 4.2 4.2
`;

export const AI_CSV_SAMPLE = `name,type,kind,artboard,layer,value
ShopFloor,artboard,board,ShopFloor,,12x8
slab,layer,#34d399,ShopFloor,slab,
furniture,layer,#60a5fa,ShopFloor,furniture,
labels,layer,#fbbf24,ShopFloor,labels,
slab,path,rect,ShopFloor,slab,12x8
counter,path,rect,ShopFloor,furniture,3x1.2
storage,path,rect,ShopFloor,furniture,3.5x2
column,path,circle,ShopFloor,furniture,0.35
aisle,path,line,ShopFloor,labels,aisle
title,path,text,ShopFloor,labels,ShopRanker
`;

export const AI_MARKDOWN_SAMPLE = `# ShopFloor

name: STRING
type: STRING
kind: STRING

ShopFloor | artboard | board
slab | layer | #34d399
furniture | layer | #60a5fa
labels | layer | #fbbf24
slab | path | rect
counter | path | rect
column | path | circle
aisle | path | line
title | path | text
`;
