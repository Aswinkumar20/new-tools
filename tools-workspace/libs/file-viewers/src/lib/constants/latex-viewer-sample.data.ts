/** Synthetic ShopRanker LaTeX snippets (education / research). */

export const LX_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "title": "ShopRanker Handbook",
  "author": "EasyToolHub",
  "docClass": "article",
  "latexVer": "1.0",
  "sections": [
    { "name": "sec1", "title": "Introduction", "level": 1, "text": "ShopRanker is a local handbook for the shop floor. The slab is twelve by eight metres." },
    { "name": "sec2", "title": "Shop floor", "level": 1, "text": "A column stands at ten, six. Keep the aisle clear along the centre line." }
  ],
  "commands": [
    { "name": "documentclass", "value": "article" },
    { "name": "usepackage", "value": "graphicx" },
    { "name": "title", "value": "ShopRanker Handbook" },
    { "name": "author", "value": "EasyToolHub" }
  ],
  "envs": [
    { "name": "fig1", "kind": "figure", "body": "Shop floor plan" },
    { "name": "eq1", "kind": "equation", "body": "E = mc^2" }
  ]
}
`;

export const LX_ASCII_SAMPLE = `LATEX dump ShopRanker 1.0
CLASS article
PACKAGE graphicx
COMMAND title ShopRanker Handbook
COMMAND author EasyToolHub
SECTION sec1 Introduction
ShopRanker is a local handbook for the shop floor. The slab is twelve by eight metres.
SECTION sec2 Shop floor
A column stands at ten, six. Keep the aisle clear along the centre line.
ENV figure fig1 Shop floor plan
ENV equation eq1 E = mc^2
`;

export const LX_TEX_SAMPLE = `\\documentclass{article}
\\usepackage{graphicx}
\\title{ShopRanker Handbook}
\\author{EasyToolHub}
\\begin{document}
\\section{Introduction}
ShopRanker is a local handbook for the shop floor. The slab is twelve by eight metres.
\\section{Shop floor}
A column stands at ten, six. Keep the aisle clear along the centre line.
\\begin{figure}
Shop floor plan
\\end{figure}
\\begin{equation}
E = mc^2
\\end{equation}
\\end{document}
`;

export const LX_CSV_SAMPLE = `name,type,kind,section,command,value
article,command,class,,documentclass,article
graphicx,command,package,,usepackage,graphicx
title,command,title,,title,ShopRanker Handbook
author,command,author,,author,EasyToolHub
sec1,section,1,Introduction,,ShopRanker is a local handbook
sec2,section,1,Shop floor,,A column stands at ten
fig1,env,figure,fig1,,Shop floor plan
eq1,env,equation,eq1,,E = mc^2
`;

export const LX_MARKDOWN_SAMPLE = `# ShopRanker Handbook

name: STRING
type: STRING
kind: STRING

article | command | class
graphicx | command | package
title | command | title
sec1 | section | Introduction
sec2 | section | Shop floor
fig1 | env | figure
eq1 | env | equation
`;
