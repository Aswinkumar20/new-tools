/** Synthetic ShopFloor SVG snippets (education / research). */

export const SV_JSON_SAMPLE = `{
  "name": "ShopFloor",
  "title": "ShopFloor plan",
  "svgVer": "1.1",
  "viewBox": "0 0 12 8",
  "width": 12,
  "height": 8,
  "layers": [
    { "name": "slab", "colorHex": "#34d399" },
    { "name": "furniture", "colorHex": "#60a5fa" },
    { "name": "labels", "colorHex": "#fbbf24" }
  ],
  "shapes": [
    { "name": "slab", "kind": "rect", "layer": "slab", "x": 0, "y": 0, "w": 12, "h": 8 },
    { "name": "counter", "kind": "rect", "layer": "furniture", "x": 1, "y": 1, "w": 3, "h": 1.2 },
    { "name": "storage", "kind": "rect", "layer": "furniture", "x": 8, "y": 0.5, "w": 3.5, "h": 2 },
    { "name": "column", "kind": "circle", "layer": "furniture", "x": 10, "y": 6, "r": 0.35 },
    { "name": "aisle", "kind": "line", "layer": "labels", "x": 6, "y": 1, "x2": 6, "y2": 7 },
    { "name": "title", "kind": "text", "layer": "labels", "x": 4.2, "y": 4.2, "text": "ShopRanker" }
  ]
}
`;

export const SV_ASCII_SAMPLE = `SVG dump ShopFloor 1.1
VIEWBOX 0 0 12 8
LAYER slab #34d399
LAYER furniture #60a5fa
LAYER labels #fbbf24
SHAPE rect slab slab 0 0 12 8
SHAPE rect counter furniture 1 1 3 1.2
SHAPE rect storage furniture 8 0.5 3.5 2
SHAPE circle column furniture 10 6 0.35
SHAPE line aisle labels 6 1 6 7
TEXT ShopRanker labels 4.2 4.2
`;

export const SV_XML_SAMPLE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 8" width="12" height="8">
  <g id="slab"><rect id="slab" x="0" y="0" width="12" height="8" fill="#34d399"/></g>
  <g id="furniture">
    <rect id="counter" x="1" y="1" width="3" height="1.2" fill="#60a5fa"/>
    <rect id="storage" x="8" y="0.5" width="3.5" height="2" fill="#60a5fa"/>
    <circle id="column" cx="10" cy="6" r="0.35" fill="#60a5fa"/>
  </g>
  <g id="labels">
    <line id="aisle" x1="6" y1="1" x2="6" y2="7" stroke="#fbbf24"/>
    <text id="title" x="4.2" y="4.2" fill="#fbbf24">ShopRanker</text>
  </g>
</svg>
`;

export const SV_CSV_SAMPLE = `name,type,kind,layer,shape,value
slab,layer,#34d399,slab,,
furniture,layer,#60a5fa,furniture,,
labels,layer,#fbbf24,labels,,
slab,shape,rect,slab,slab,12x8
counter,shape,rect,furniture,counter,3x1.2
storage,shape,rect,furniture,storage,3.5x2
column,shape,circle,furniture,column,0.35
aisle,shape,line,labels,aisle,aisle
title,shape,text,labels,title,ShopRanker
`;

export const SV_MARKDOWN_SAMPLE = `# ShopFloor

name: STRING
type: STRING
kind: STRING

slab | layer | #34d399
furniture | layer | #60a5fa
labels | layer | #fbbf24
slab | shape | rect
counter | shape | rect
column | shape | circle
aisle | shape | line
title | shape | text
`;
