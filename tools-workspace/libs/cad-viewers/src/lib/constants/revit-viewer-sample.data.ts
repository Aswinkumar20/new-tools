/** Classroom wing Revit snippets (education / research). */

export const RV_JSON_SAMPLE = `{
  "name": "Classroom Wing",
  "revitVer": "2024",
  "units": "m",
  "families": [
    { "name": "ClassroomFloor", "category": "Floors", "description": "floor family" },
    { "name": "TeacherDesk", "category": "Furniture", "description": "desk family" },
    { "name": "Column", "category": "Columns", "description": "structural column" }
  ],
  "types": [
    { "name": "Floor", "family": "ClassroomFloor", "category": "Floors", "description": "generic floor" },
    { "name": "Mount", "family": "TeacherDesk", "category": "Furniture", "description": "teacher desk" },
    { "name": "RoundColumn", "family": "Column", "category": "Columns", "description": "round column" }
  ],
  "instances": [
    { "name": "slab", "family": "ClassroomFloor", "type": "Floor", "category": "Floors", "kind": "box", "cx": 6, "cy": 4, "cz": 0.075, "sx": 12, "sy": 8, "sz": 0.15 },
    { "name": "desk", "family": "TeacherDesk", "type": "Mount", "category": "Furniture", "kind": "box", "cx": 2.5, "cy": 1.6, "cz": 0.45, "sx": 3, "sy": 1.2, "sz": 0.9 },
    { "name": "column", "family": "Column", "type": "RoundColumn", "category": "Columns", "kind": "cylinder", "cx": 10, "cy": 6, "cz": 1.2, "r": 0.35, "h": 2.4 }
  ]
}
`;

export const RV_ASCII_SAMPLE = `REVIT dump Classroom-Wing 2024
FAMILY ClassroomFloor Floors floor family
FAMILY TeacherDesk Furniture desk family
FAMILY Column Columns structural column
TYPE Floor ClassroomFloor Floors generic floor
TYPE Mount TeacherDesk Furniture teacher desk
TYPE RoundColumn Column Columns round column
INSTANCE slab FAMILY ClassroomFloor TYPE Floor CAT Floors BOX 16 10 0.2 AT 8 5 0.1
INSTANCE desk FAMILY TeacherDesk TYPE Mount CAT Furniture BOX 2.4 1.0 0.75 AT 3.2 2.0 0.5
INSTANCE column FAMILY Column TYPE RoundColumn CAT Columns CYLINDER 0.4 3.2 AT 13 8 1.6
`;

export const RV_CSV_SAMPLE = `name,type,kind,family,category,value
ClassroomFloor,family,,Clinic,Floors,floor family
TeacherDesk,family,,TeacherDesk,Furniture,desk family
Column,family,,Column,Columns,structural column
Floor,type,,Clinic,Floors,generic floor
Mount,type,,TeacherDesk,Furniture,teacher desk
slab,instance,box,Clinic,Floors,Floor
desk,instance,box,TeacherDesk,Furniture,Mount
column,instance,cylinder,Column,Columns,RoundColumn
`;

export const RV_MARKDOWN_SAMPLE = `# Classroom Wing

name: STRING
type: STRING
kind: STRING

ClassroomFloor | family | Floors
TeacherDesk | family | Furniture
Column | family | Columns
Floor | type | Clinic
Mount | type | TeacherDesk
slab | instance | box
desk | instance | box
column | instance | cylinder
`;
