/** Outline plot HPGL snippets (education / research). */

export const HG_ASCII_SAMPLE = `HPGL dump Outline-Plot HPGL/2
PEN OUTLINE 1
PEN HOLES 5
PEN LABEL 3
IN;
SP1;
PU0,0;
PD10,0,10,6,0,6,0,0;
SP5;
PU1.5,1.2;
PD3.8,1.2,3.8,2.6,1.5,2.6,1.5,1.2;
PU8,4.5;
CI0.3;
PU5,0.8;
PD5,5.2;
SP3;
PU3.2,2.8;
LBOUTLINE-PLOT;
`;

export const HG_JSON_SAMPLE = `{
  "name": "Outline Plot",
  "plotterVer": "HPGL/2",
  "units": "m",
  "layers": [
    { "name": "OUTLINE", "color": 1 },
    { "name": "HOLES", "color": 5 },
    { "name": "LABEL", "color": 3 }
  ],
  "commands": [
    { "name": "outline", "type": "polyline", "layer": "OUTLINE", "points": [[0,0],[10,0],[10,6],[0,6],[0,0]] },
    { "name": "pocket", "type": "polyline", "layer": "HOLES", "points": [[1.5,1.2],[3.8,1.2],[3.8,2.6],[1.5,2.6],[1.5,1.2]] },
    { "name": "hole1", "type": "circle", "layer": "HOLES", "x": 8, "y": 4.5, "r": 0.3 },
    { "name": "centerline", "type": "line", "layer": "HOLES", "x": 5, "y": 0.8, "x2": 5, "y2": 5.2 },
    { "name": "title", "type": "text", "layer": "LABEL", "x": 3.2, "y": 2.8, "text": "OUTLINE-PLOT" }
  ]
}
`;

export const HG_CSV_SAMPLE = `name,type,layer,x,y,x2,y2,r,text
OUTLINE,layer,OUTLINE,,,,,
HOLES,layer,HOLES,,,,,
south-edge,line,OUTLINE,0,0,10,0,,
east-edge,line,OUTLINE,10,0,10,6,,
north-edge,line,OUTLINE,10,6,0,6,,
west-edge,line,OUTLINE,0,6,0,0,,
hole1,circle,HOLES,8,4.5,,,0.3,
title,text,LABEL,3.2,2.8,,,,OUTLINE-PLOT
`;

export const HG_MARKDOWN_SAMPLE = `# Outline Plot

name: STRING
type: STRING
layer: STRING

OUTLINE | layer | OUTLINE
HOLES | layer | HOLES
south-edge | line | OUTLINE
east-edge | line | OUTLINE
north-edge | line | OUTLINE
west-edge | line | OUTLINE
hole1 | circle | HOLES
title | text | LABEL
`;
