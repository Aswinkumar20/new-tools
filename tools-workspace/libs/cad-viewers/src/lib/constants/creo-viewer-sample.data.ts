/** Crank arm Creo snippets Creo snippets (education / research). */

export const CR_JSON_SAMPLE = `{
  "name": "Crank Arm",
  "version": "11.0",
  "units": "m",
  "parts": [
    { "name": "arm", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "boss", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "pin", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ],
  "assemblies": [
    { "name": "Crank Arm", "description": "crank arm" },
    { "name": "CrankArm", "description": "crank arm" }
  ],
  "instances": [
    { "name": "arm-1", "part": "arm", "assembly": "CrankArm", "cx": 6, "cy": 4, "cz": 0.075 },
    { "name": "boss-1", "part": "boss", "assembly": "CrankArm", "cx": 2.5, "cy": 1.6, "cz": 0.45 },
    { "name": "pin-1", "part": "pin", "assembly": "CrankArm", "cx": 10, "cy": 6, "cz": 1.2 },
    { "name": "boss-2", "part": "boss", "assembly": "CrankArm", "cx": 0, "cy": 0, "cz": 0.45 }
  ]
}
`;

export const CR_ASCII_SAMPLE = `Creo dump Crank-Arm 11.0
PRT arm BOX 12 8 0.15 AT 6 4 0.075
PRT boss BOX 3 1.2 0.9 AT 2.5 1.6 0.45
PRT pin CYLINDER 0.35 2.4 AT 10 6 1.2
ASM CrankArm
ASSEMBLY CrankArm
INSTANCE arm-1 PART arm IN CrankArm AT 6 4 0.075
INSTANCE boss-1 PART boss IN CrankArm AT 2.5 1.6 0.45
INSTANCE pin-1 PART pin IN CrankArm AT 10 6 1.2
INSTANCE boss-2 PART boss IN CrankArm AT 0 0 0.45
`;

export const CR_CSV_SAMPLE = `name,type,kind,part,assembly,cx,cy,cz,sx,sy,sz,r,h
arm,part,box,,,2.75,0.7,0.18,5.5,1.4,0.35,,
boss,part,box,,,0.7,0.7,0.4,1.2,1.2,0.4,,
pin,part,cylinder,,,4.8,0.7,0.18,,,,0.22,0.7
CrankArm,assembly,,,,,,,,,
CrankArm,assembly,,,,,,,,,
arm-1,instance,,arm,CrankArm,2.75,0.7,0.18,,,,,
pin-1,instance,,pin,CrankArm,4.8,0.7,0.18,,,,,
`;

export const CR_MARKDOWN_SAMPLE = `# Crank Arm

name: STRING
type: STRING
kind: STRING

arm | part | box
boss | part | box
pin | part | cylinder
CrankArm | assembly | layout
CrankArm | assembly | mount
arm-1 | instance | arm
`;
