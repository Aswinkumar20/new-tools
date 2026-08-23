/** Permit set DWF publish dump snippets (education / research). */

export const WF_JSON_SAMPLE = `{
  "name": "Permit Set",
  "version": "6.01",
  "units": "m",
  "sheets": [
    { "name": "Cover", "width": 11, "height": 8.5 },
    { "name": "A1", "width": 11, "height": 8.5 }
  ],
  "layers": [
    { "name": "BORDER", "color": 1, "visible": true },
    { "name": "PLAN", "color": 5, "visible": true },
    { "name": "MARKUP", "color": 3, "visible": true }
  ],
  "entities": [
    { "name": "title-block", "type": "text", "sheet": "Cover", "layer": "MARKUP", "x": 4, "y": 4.2, "text": "PERMIT SET" },
    { "name": "south-wall", "type": "line", "sheet": "A1", "layer": "PLAN", "x": 0, "y": 0, "x2": 11, "y2": 0 },
    { "name": "east-wall", "type": "line", "sheet": "A1", "layer": "PLAN", "x": 11, "y": 0, "x2": 11, "y2": 8.5 },
    { "name": "north-wall", "type": "line", "sheet": "A1", "layer": "PLAN", "x": 11, "y": 8.5, "x2": 0, "y2": 8.5 },
    { "name": "west-wall", "type": "line", "sheet": "A1", "layer": "PLAN", "x": 0, "y": 8.5, "x2": 0, "y2": 0 },
    { "name": "stair", "type": "polyline", "sheet": "A1", "layer": "PLAN", "points": [[1,1],[3.2,1],[3.2,2.4],[1,2.4]] },
    { "name": "column", "type": "circle", "sheet": "A1", "layer": "PLAN", "x": 9, "y": 6.5, "r": 0.3 },
    { "name": "egress", "type": "line", "sheet": "A1", "layer": "PLAN", "x": 5.5, "y": 1, "x2": 5.5, "y2": 7.5 },
    { "name": "plan-label", "type": "text", "sheet": "A1", "layer": "MARKUP", "x": 4, "y": 4.2, "text": "PERMIT SET" },
    { "name": "review-note", "type": "markup", "sheet": "A1", "layer": "MARKUP", "x": 6, "y": 3.2, "text": "Check egress" }
  ]
}
`;

export const WF_CSV_SAMPLE = `name,type,sheet,layer,x,y,x2,y2,r,text
Cover,sheet,Cover,,,,,,,
A1,sheet,A1,,,,,,,
BORDER,layer,,BORDER,,,,,
PLAN,layer,,PLAN,,,,,
title-block,text,Cover,MARKUP,4,4.2,,,,PERMIT SET
south-wall,line,A1,PLAN,0,0,11,0,,
east-wall,line,A1,PLAN,11,0,11,8.5,,
north-wall,line,A1,PLAN,11,8.5,0,8.5,,
west-wall,line,A1,PLAN,0,8.5,0,0,,
column,circle,A1,PLAN,9,6.5,,,0.3,
review-note,markup,A1,MARKUP,6,3.2,,,,Check egress
`;

export const WF_MARKDOWN_SAMPLE = `# Permit Set

name: STRING
type: STRING
sheet: STRING
layer: STRING

Cover | sheet | Cover | MARKUP
A1 | sheet | A1 | PLAN
BORDER | layer | A1 | BORDER
PLAN | layer | A1 | PLAN
title-block | text | Cover | MARKUP
south-wall | line | A1 | PLAN
east-wall | line | A1 | PLAN
north-wall | line | A1 | PLAN
west-wall | line | A1 | PLAN
column | circle | A1 | PLAN
review-note | markup | A1 | MARKUP
`;
