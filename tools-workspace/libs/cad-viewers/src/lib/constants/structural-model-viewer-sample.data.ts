/** Parking frame structural snippets (education / research). */

export const SR_JSON_SAMPLE = `{
  "name": "Parking Frame",
  "structVer": "1.0",
  "units": "m",
  "sections": [
    { "name": "Columns", "description": "RC" },
    { "name": "Beams", "description": "steel" },
    { "name": "Slabs", "description": "floor" }
  ],
  "members": [
    { "name": "slab", "kind": "box", "memberType": "Slab", "section": "Slabs", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "column", "kind": "cylinder", "memberType": "Column", "section": "Columns", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 },
    { "name": "beam", "kind": "box", "memberType": "Beam", "section": "Beams", "cx": 6, "cy": 6, "cz": 2.4, "sx": 8, "sy": 0.3, "sz": 0.4 },
    { "name": "footing", "kind": "box", "memberType": "Footing", "section": "Columns", "cx": 10, "cy": 6, "cz": 0.2, "sx": 0.8, "sy": 0.8, "sz": 0.4 }
  ],
  "properties": [
    { "name": "bay-width", "pset": "Pset", "member": "column", "value": "28", "unit": "m" },
    { "name": "title", "pset": "Pset", "member": "column", "value": "Parking", "unit": "" }
  ]
}
`;

export const SR_ASCII_SAMPLE = `STRUCT dump Parking-Frame 1.0
SECTION Columns RC
SECTION Beams steel
SECTION Slabs floor
MEMBER slab Slabs BOX 28 18 0.3 AT 14 9 0.15
MEMBER column Columns CYLINDER 0.5 5.0 AT 22 14 2.5
MEMBER beam Beams BOX 18 0.4 0.7 AT 14 14 5.0
MEMBER footing Columns BOX 0.8 0.8 0.4 AT 10 6 0.2
PROPERTY bay-width Pset column 12 m
PROPERTY title Pset column Parking
`;

export const SR_STEP_SAMPLE = `ISO-10303-21;
HEADER;
FILE_SCHEMA(('IFC4'));
ENDSEC;
DATA;
#1=IFCSLAB('slab',$,$,$,$,$,$,$,$);
#2=IFCCOLUMN('column',$,$,$,$,$,$,$,$);
#3=IFCBEAM('beam',$,$,$,$,$,$,$,$);
#4=IFCFOOTING('footing',$,$,$,$,$,$,$,$);
#5=IFCPROPERTYSINGLEVALUE('bay-width',$,IFCLENGTHMEASURE(28.),$);
#6=IFCPROPERTYSINGLEVALUE('title',$,IFCLABEL('Parking'),$);
ENDSEC;
END-ISO-10303-21;
`;

export const SR_CSV_SAMPLE = `name,type,kind,section,member,value
Columns,section,,Columns,,RC
Beams,section,,Beams,,steel
Slabs,section,,Slabs,,floor
slab,member,box,Slabs,slab,Slab
column,member,cylinder,Columns,column,Column
beam,member,box,Beams,beam,Beam
footing,member,box,Columns,footing,Footing
bay-width,property,Pset,Columns,column,28
title,property,Pset,Columns,column,Parking
`;

export const SR_MARKDOWN_SAMPLE = `# Parking Frame

name: STRING
type: STRING
kind: STRING

Columns | section | rc
Beams | section | steel
Slabs | section | floor
slab | member | box
column | member | cylinder
beam | member | box
footing | member | box
bay-width | property | pset
title | property | pset
`;
