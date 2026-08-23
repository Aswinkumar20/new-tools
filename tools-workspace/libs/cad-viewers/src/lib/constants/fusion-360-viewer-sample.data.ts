/** Enclosure lid Fusion 360 snippets Fusion 360 snippets (education / research). */

export const FU_JSON_SAMPLE = `{
  "name": "Enclosure Lid",
  "version": "2.0.2024",
  "units": "m",
  "bodies": [
    { "name": "lid", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "lip", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "standoff", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "components": [
    { "name": "Enclosure Lid", "description": "enclosure lid" },
    { "name": "EnclosureLid", "description": "enclosure lid" }
  ],
  "instances": [
    { "name": "lid-1", "body": "lid", "component": "EnclosureLid", "cx": 6, "cy": 4, "cz": 0.075 },
    { "name": "lip-1", "body": "lip", "component": "EnclosureLid", "cx": 2.5, "cy": 1.6, "cz": 0.45 },
    { "name": "standoff-1", "body": "standoff", "component": "EnclosureLid", "cx": 10, "cy": 6, "cz": 1.2 },
    { "name": "lip-2", "body": "lip", "component": "EnclosureLid", "cx": 0, "cy": 0, "cz": 0.45 }
  ]
}
`;

export const FU_ASCII_SAMPLE = `Fusion 360 dump Enclosure-Lid 2.0.2024
BODY lid BOX 12 8 0.15 AT 6 4 0.075
BODY lip BOX 3 1.2 0.9 AT 2.5 1.6 0.45
BODY standoff CYLINDER 0.35 2.4 AT 10 6 1.2
COMPONENT EnclosureLid
COMPONENT EnclosureLid
INSTANCE lid-1 BODY lid IN EnclosureLid AT 6 4 0.075
INSTANCE lip-1 BODY lip IN EnclosureLid AT 2.5 1.6 0.45
INSTANCE standoff-1 BODY standoff IN EnclosureLid AT 10 6 1.2
INSTANCE lip-2 BODY lip IN EnclosureLid AT 0 0 0.45
`;

export const FU_CSV_SAMPLE = `name,type,kind,body,component,cx,cy,cz,sx,sy,sz,r,h
lid,body,box,,,3.6,2.7,0.09,7.2,5.4,0.18,,
lip,body,box,,,3.6,2.7,0.12,6.8,5.0,0.12,,
standoff,body,cylinder,,,6.4,4.8,0.3,,,,0.18,0.55
EnclosureLid,component,,,,,,,,,
EnclosureLid,component,,,,,,,,,
lid-1,instance,,lid,EnclosureLid,3.6,2.7,0.09,,,,,
standoff-1,instance,,standoff,EnclosureLid,6.4,4.8,0.3,,,,,
`;

export const FU_MARKDOWN_SAMPLE = `# Enclosure Lid

name: STRING
type: STRING
kind: STRING

lid | body | box
lip | body | box
standoff | body | cylinder
EnclosureLid | component | layout
EnclosureLid | component | mount
lid-1 | instance | lid
`;
