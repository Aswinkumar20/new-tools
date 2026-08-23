/** Hotel L3 plan snippets (education / research). */

export const FP_JSON_SAMPLE = `{
  "name": "Hotel L3",
  "planVer": "1.0",
  "units": "m",
  "levels": [
    { "name": "Ground", "elevation": 0, "description": "hotel L3" },
    { "name": "Mezzanine", "elevation": 3.2, "description": "mezz" }
  ],
  "rooms": [
    { "name": "Lobby", "level": "Ground", "x": 0, "y": 0, "x2": 22, "y2": 14 },
    { "name": "Guest", "level": "Ground", "x": 1, "y": 1, "x2": 4, "y2": 2.2 },
    { "name": "Housekeeping", "level": "Ground", "x": 8, "y": 0.5, "x2": 11.5, "y2": 2.5 }
  ],
  "spaces": [
    { "name": "Lobby", "kind": "room", "level": "Ground", "x": 0, "y": 0, "x2": 22, "y2": 14 },
    { "name": "Guest", "kind": "room", "level": "Ground", "x": 1, "y": 1, "x2": 4, "y2": 2.2 },
    { "name": "Housekeeping", "kind": "room", "level": "Ground", "x": 8, "y": 0.5, "x2": 11.5, "y2": 2.5 },
    { "name": "col1", "kind": "column", "level": "Ground", "x": 18, "y": 11, "r": 0.35 },
    { "name": "aisle", "kind": "aisle", "level": "Ground", "x": 11, "y": 1, "x2": 11, "y2": 13 },
    { "name": "Lobby", "kind": "text", "level": "Ground", "x": 9, "y": 7, "text": "Lobby" }
  ]
}
`;

export const FP_ASCII_SAMPLE = `FLOOR dump Hotel-L3 1.0
LEVEL Ground 0 hotel L3
LEVEL Mezzanine 3.2 mezz
ROOM Lobby Ground 0 0 22 14
ROOM Guest Ground 1 1 4 2.2
ROOM Housekeeping Ground 8 0.5 11.5 2.5
COLUMN col1 Ground 18 11 0.4
AISLE aisle Ground 11 1 11 13
TEXT Lobby Ground 9 7
`;

export const FP_STEP_SAMPLE = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCBUILDINGSTOREY('Ground',$,$,$,$,$,$,$,.ELEMENT.,0.);
#2=IFCSPACE('Lobby',$,$,$,$,$,$,$,.ELEMENT.,$);
#3=IFCSPACE('Guest',$,$,$,$,$,$,$,.ELEMENT.,$);
#4=IFCSPACE('Housekeeping',$,$,$,$,$,$,$,.ELEMENT.,$);
#5=IFCCOLUMN('col1',$,$,$,$,$,$,$,$);
#6=IFCTEXT('Lobby',$,$,$,$,$,$,$,$);
ENDSEC;
END-ISO-10303-21;
`;

export const FP_CSV_SAMPLE = `name,type,kind,level,room,x
Ground,level,,Ground,,0
Mezzanine,level,,Mezzanine,,3.2
Lobby,room,,Ground,Clinic,0
Guest,room,,Ground,Guest,1
Housekeeping,room,,Ground,Housekeeping,8
col1,space,column,Ground,,10
aisle,space,aisle,Ground,,6
Lobby,space,text,Ground,,4.2
`;

export const FP_MARKDOWN_SAMPLE = `# Hotel L3

name: STRING
type: STRING
kind: STRING

Ground | level | ground
Mezzanine | level | mezz
Lobby | room | room
Guest | room | room
Housekeeping | room | room
col1 | space | column
aisle | space | aisle
Lobby | space | text
`;
