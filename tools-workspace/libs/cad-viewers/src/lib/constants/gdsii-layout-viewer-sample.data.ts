/** NAND2_X1 standard-cell GDSII snippets (education / research). */

export const GD_ASCII_SAMPLE = `GDSII dump NAND2_X1 5.0
LAYER 1 metal 0
LAYER 2 poly 1
LAYER 10 contact 2
LAYER 20 nwell 3
CELL TOP
CELL NAND2_X1
BOUNDARY outline TOP 1 0,0 12,0 12,8 0,8 0,0
PATH poly-gate TOP 1 6 1 6 7 0.15
BOUNDARY active TOP 1 1,1 4,1 4,2.2 1,2.2 1,1
BOX via1 TOP 10 10 6 0.35
SREF NAND2_X1 TOP 1 4.2 4.2
TEXT title TOP 2 4.2 4.2 NAND2_X1
`;

export const GD_STREAM_SAMPLE = `HEADER 5
BGNLIB NAND2_X1
UNITS 0.001 um
LAYER 1 metal
BOUNDARY outline TOP 1 0 0 12 0 12 8 0 8 0 0
PATH poly-gate TOP 1 6 1 6 7
TEXT title TOP 2 4.2 4.2 NAND2_X1
ENDEL
ENDLIB
`;

export const GD_JSON_SAMPLE = `{
  "name": "NAND2_X1",
  "gdsVer": "5.0",
  "units": "um",
  "layers": [
    { "name": "1", "function": "metal", "stackIndex": 0, "color": 4 },
    { "name": "2", "function": "poly", "stackIndex": 1, "color": 7 },
    { "name": "10", "function": "contact", "stackIndex": 2, "color": 2 },
    { "name": "20", "function": "well", "stackIndex": 3, "color": 3 }
  ],
  "cells": [
    { "name": "TOP" },
    { "name": "NAND2_X1" }
  ],
  "features": [
    { "name": "outline", "type": "boundary", "layer": "1", "cell": "TOP", "points": [[0,0],[12,0],[12,8],[0,8],[0,0]] },
    { "name": "poly-gate", "type": "path", "layer": "1", "cell": "TOP", "x": 6, "y": 1, "x2": 6, "y2": 7, "width": 0.15 },
    { "name": "active", "type": "boundary", "layer": "1", "cell": "TOP", "points": [[1,1],[4,1],[4,2.2],[1,2.2],[1,1]] },
    { "name": "via1", "type": "box", "layer": "10", "cell": "TOP", "x": 10, "y": 6, "r": 0.35 },
    { "name": "NAND2_X1", "type": "sref", "layer": "1", "cell": "TOP", "x": 4.2, "y": 4.2, "text": "NAND2_X1" },
    { "name": "title", "type": "text", "layer": "2", "cell": "TOP", "x": 4.2, "y": 4.2, "text": "NAND2_X1" }
  ]
}
`;

export const GD_CSV_SAMPLE = `name,type,layer,cell,domain,x,y,x2,y2,r,text
1,layer,1,,,,,,,
TOP,cell,,TOP,,,,,,
outline,boundary,1,TOP,plot,0,0,,,,
via1,box,10,TOP,plot,10,6,,,0.35,
title,text,2,TOP,plot,4.2,4.2,,,,NAND2_X1
`;

export const GD_MARKDOWN_SAMPLE = `# NAND2_X1

name: STRING
type: STRING
layer: STRING
cell: STRING
domain: STRING

1 | layer | 1
TOP | cell | | TOP
outline | boundary | 1 | TOP | plot
via1 | box | 10 | TOP | plot
title | text | 2 | TOP | plot
`;
