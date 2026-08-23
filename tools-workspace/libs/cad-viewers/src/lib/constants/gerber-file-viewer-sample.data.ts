/** RF shield Gerber snippets Gerber snippets (education / research). */

export const GB_ASCII_SAMPLE = `Gerber dump RF-Shield RS-274X
LAYER TOP_COPPER copper 4
LAYER TOP_SILK silk 7
LAYER TOP_MASK mask 3
LAYER OUTLINE outline 5
LINE south-edge OUTLINE 0 0 12 0
LINE east-edge OUTLINE 6 0 6 4
LINE north-edge OUTLINE 6 4 0 4
LINE west-edge OUTLINE 0 4 0 0
POLYGON pour TOP_COPPER 1,1 4,1 4,2.2 1,2.2 1,1
LINE aisle TOP_COPPER 6 1 6 7
FLASH via1 TOP_COPPER 10 6 0.35
FLASH mask-via TOP_MASK 10 6 0.45
TEXT title TOP_SILK 4.2 4.2 RF-SHIELD
`;

export const GB_RS274X_SAMPLE = `G04 Gerber dump RF-Shield RS-274X*
%MOMM*%
%TF.FileFunction,Copper,L1,Top*%
%ADD10C,0.20*%
%ADD11C,0.70*%
%LPD*%
D10*
X0Y0D02*
X6000Y0D01*
X6000Y4000D01*
X0Y4000D01*
X0Y0D01*
X1000Y1000D02*
X4000Y1000D01*
X4000Y2200D01*
X1000Y2200D01*
X1000Y1000D01*
X6000Y1000D02*
X6000Y7000D01*
D11*
X10000Y6000D03*
M02*
`;

export const GB_JSON_SAMPLE = `{
  "name": "RF Shield",
  "gerberVer": "RS-274X",
  "units": "mm",
  "layers": [
    { "name": "TOP_COPPER", "function": "copper", "color": 4 },
    { "name": "TOP_SILK", "function": "silk", "color": 7 },
    { "name": "TOP_MASK", "function": "mask", "color": 3 },
    { "name": "OUTLINE", "function": "outline", "color": 5 }
  ],
  "features": [
    { "name": "south-edge", "type": "line", "layer": "OUTLINE", "x": 0, "y": 0, "x2": 6, "y2": 0 },
    { "name": "east-edge", "type": "line", "layer": "OUTLINE", "x": 6, "y": 0, "x2": 6, "y2": 4 },
    { "name": "north-edge", "type": "line", "layer": "OUTLINE", "x": 6, "y": 8, "x2": 0, "y2": 4 },
    { "name": "west-edge", "type": "line", "layer": "OUTLINE", "x": 0, "y": 4, "x2": 0, "y2": 0 },
    { "name": "pour", "type": "polygon", "layer": "TOP_COPPER", "points": [[1,1],[4,1],[4,2.2],[1,2.2],[1,1]] },
    { "name": "aisle", "type": "line", "layer": "TOP_COPPER", "x": 6, "y": 1, "x2": 6, "y2": 7 },
    { "name": "via1", "type": "flash", "layer": "TOP_COPPER", "x": 10, "y": 6, "r": 0.35 },
    { "name": "mask-via", "type": "flash", "layer": "TOP_MASK", "x": 10, "y": 6, "r": 0.45 },
    { "name": "title", "type": "text", "layer": "TOP_SILK", "x": 4.2, "y": 4.2, "text": "RF-SHIELD" }
  ]
}
`;

export const GB_CSV_SAMPLE = `name,type,layer,x,y,x2,y2,r,text
TOP_COPPER,layer,TOP_COPPER,,,,,
TOP_SILK,layer,TOP_SILK,,,,,
TOP_MASK,layer,TOP_MASK,,,,,
south-edge,line,OUTLINE,0,0,6,0,,
via1,flash,TOP_COPPER,10,6,,,0.35,
title,text,TOP_SILK,4.2,4.2,,,,RF-SHIELD
`;

export const GB_MARKDOWN_SAMPLE = `# RF Shield

name: STRING
type: STRING
layer: STRING

TOP_COPPER | layer | TOP_COPPER
TOP_SILK | layer | TOP_SILK
TOP_MASK | layer | TOP_MASK
south-edge | line | OUTLINE
via1 | flash | TOP_COPPER
title | text | TOP_SILK
`;
