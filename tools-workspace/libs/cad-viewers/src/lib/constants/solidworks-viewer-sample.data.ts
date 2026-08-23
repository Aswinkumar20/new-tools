/** Valve body SolidWorks snippets SolidWorks snippets (education / research). */

export const SW_JSON_SAMPLE = `{
  "name": "Valve Body",
  "version": "2024",
  "units": "m",
  "parts": [
    { "name": "body", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "flange", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "stem", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "assemblies": [
    { "name": "Valve Body", "description": "valve body" },
    { "name": "ValveBody", "description": "valve body" }
  ],
  "instances": [
    { "name": "body-1", "part": "body", "assembly": "ValveBody", "cx": 6, "cy": 4, "cz": 0.075 },
    { "name": "flange-1", "part": "flange", "assembly": "ValveBody", "cx": 2.5, "cy": 1.6, "cz": 0.45 },
    { "name": "stem-1", "part": "stem", "assembly": "ValveBody", "cx": 10, "cy": 6, "cz": 1.2 },
    { "name": "flange-2", "part": "flange", "assembly": "ValveBody", "cx": 0, "cy": 0, "cz": 0.45 }
  ]
}
`;

export const SW_ASCII_SAMPLE = `SolidWorks dump Valve-Body 2024
SLDPRT body BOX 12 8 0.15 AT 6 4 0.075
SLDPRT flange BOX 3 1.2 0.9 AT 2.5 1.6 0.45
SLDPRT stem CYLINDER 0.35 2.4 AT 10 6 1.2
SLDASM ValveBody
ASSEMBLY ValveBody
INSTANCE body-1 PART body IN ValveBody AT 6 4 0.075
INSTANCE flange-1 PART flange IN ValveBody AT 2.5 1.6 0.45
INSTANCE stem-1 PART stem IN ValveBody AT 10 6 1.2
INSTANCE flange-2 PART flange IN ValveBody AT 0 0 0.45
`;

export const SW_CSV_SAMPLE = `name,type,kind,part,assembly,cx,cy,cz,sx,sy,sz,r,h
body,part,box,,,1.6,1.6,1.0,3.2,3.2,2.0,,
flange,part,box,,,1.6,1.6,2.1,4.4,4.4,0.25,,
stem,part,cylinder,,,1.6,1.6,2.3,,,,0.18,2.6
ValveBody,assembly,,,,,,,,,
ValveBody,assembly,,,,,,,,,
body-1,instance,,body,ValveBody,1.6,1.6,1.0,,,,,
stem-1,instance,,stem,ValveBody,1.6,1.6,2.3,,,,,
`;

export const SW_MARKDOWN_SAMPLE = `# Valve Body

name: STRING
type: STRING
kind: STRING

body | part | box
flange | part | box
stem | part | cylinder
ValveBody | assembly | layout
ValveBody | assembly | mount
body-1 | instance | body
`;
