/** Title block PLT / HPGL snippets (education / research). */

export const PL_ASCII_SAMPLE = `PLT dump Title-Block HPGL/2
PEN BORDER 1
PEN TB 5
PEN NOTES 3
IN;
SP1;
PU0,0;
PD11,0,11,8.5,0,8.5,0,0;
SP5;
PU0.6,0.5;
PD4.2,0.5,4.2,1.8,0.6,1.8,0.6,0.5;
PU9.4,6.8;
CI0.28;
PU5.5,0.6;
PD5.5,8;
SP3;
PU3.4,4;
LBTITLE-BLOCK;
`;

export const PL_JSON_SAMPLE = `{
  "name": "Title Block",
  "plotterVer": "HPGL/2",
  "units": "m",
  "pens": [
    { "name": "BORDER", "color": 1 },
    { "name": "TB", "color": 5 },
    { "name": "NOTES", "color": 3 }
  ],
  "commands": [
    { "name": "border", "type": "polyline", "pen": "BORDER", "points": [[0,0],[11,0],[11,8.5],[0,8.5],[0,0]] },
    { "name": "rev-box", "type": "polyline", "pen": "TB", "points": [[0.6,0.5],[4.2,0.5],[4.2,1.8],[0.6,1.8],[0.6,0.5]] },
    { "name": "rev-bubble", "type": "circle", "pen": "TB", "x": 9.4, "y": 6.8, "r": 0.28 },
    { "name": "fold", "type": "line", "pen": "TB", "x": 5.5, "y": 0.6, "x2": 5.5, "y2": 8 },
    { "name": "title", "type": "text", "pen": "NOTES", "x": 3.4, "y": 4, "text": "TITLE-BLOCK" }
  ]
}
`;

export const PL_CSV_SAMPLE = `name,type,pen,x,y,x2,y2,r,text
BORDER,pen,BORDER,,,,,
TB,pen,TB,,,,,
south-edge,line,BORDER,0,0,11,0,,
east-edge,line,BORDER,11,0,11,8.5,,
north-edge,line,BORDER,11,8.5,0,8.5,,
west-edge,line,BORDER,0,8.5,0,0,,
rev-bubble,circle,TB,9.4,6.8,,,0.28,
title,text,NOTES,3.4,4,,,,TITLE-BLOCK
`;

export const PL_MARKDOWN_SAMPLE = `# Title Block

name: STRING
type: STRING
pen: STRING

BORDER | pen | BORDER
TB | pen | TB
south-edge | line | BORDER
east-edge | line | BORDER
north-edge | line | BORDER
west-edge | line | BORDER
rev-bubble | circle | TB
title | text | NOTES
`;
