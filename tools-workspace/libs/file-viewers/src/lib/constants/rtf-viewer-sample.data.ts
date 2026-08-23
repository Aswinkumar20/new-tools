/** Synthetic ShopRanker RTF snippets (education / research). */

export const RT_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "title": "ShopRanker Notes",
  "author": "EasyToolHub",
  "rtfVer": "1.0",
  "styles": [
    { "name": "heading", "kind": "heading", "weight": "bold", "size": "18" },
    { "name": "emphasis", "kind": "emphasis", "weight": "italic", "size": "12" },
    { "name": "body", "kind": "body", "weight": "normal", "size": "12" }
  ],
  "blocks": [
    { "name": "title", "kind": "heading", "text": "ShopRanker" },
    { "name": "intro", "kind": "para", "text": "The shop floor slab is twelve by eight metres." },
    { "name": "notes", "kind": "para", "text": "Aisle 6,1 to 6,7. Column r=0.35 at 10,6." }
  ],
  "spans": [
    { "name": "title", "kind": "bold", "style": "heading", "text": "ShopRanker" },
    { "name": "slab", "kind": "normal", "style": "body", "text": "The shop floor slab is twelve by eight metres." },
    { "name": "counter", "kind": "italic", "style": "emphasis", "text": "Counter at 1,1. Storage at 8,0.5." },
    { "name": "aisle", "kind": "normal", "style": "body", "text": "Aisle 6,1 to 6,7. Column r=0.35 at 10,6." }
  ],
  "sourceText": "{\\\\rtf1\\\\ansi ShopRanker\\\\par The shop floor slab is twelve by eight metres.}"
}
`;

export const RT_ASCII_SAMPLE = `RTF dump ShopRanker 1.0
TITLE ShopRanker Notes
AUTHOR EasyToolHub
STYLE heading bold 18
STYLE emphasis italic 12
STYLE body normal 12
BLOCK heading ShopRanker
SPAN bold heading ShopRanker
SPAN normal body The shop floor slab is twelve by eight metres.
SPAN italic emphasis Counter at 1,1. Storage at 8,0.5.
SPAN normal body Aisle 6,1 to 6,7. Column r=0.35 at 10,6.
`;

export const RT_RTF_SAMPLE = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0 Times New Roman;}}
\\b ShopRanker\\b0\\par
The shop floor slab is twelve by eight metres.\\par
\\i Counter at 1,1. Storage at 8,0.5.\\i0\\par
Aisle 6,1 to 6,7. Column r=0.35 at 10,6.\\par
}
`;

export const RT_CSV_SAMPLE = `name,type,kind,style,block,value
heading,style,heading,heading,,bold 18
emphasis,style,emphasis,emphasis,,italic 12
body,style,body,body,,normal 12
title,block,heading,,title,ShopRanker
intro,block,para,,intro,The shop floor slab is twelve by eight metres.
title,span,bold,heading,title,ShopRanker
slab,span,normal,body,intro,The shop floor slab is twelve by eight metres.
counter,span,italic,emphasis,,Counter at 1,1. Storage at 8,0.5.
`;

export const RT_MARKDOWN_SAMPLE = `# ShopRanker Notes

name: STRING
type: STRING
kind: STRING

heading | style | bold
emphasis | style | italic
body | style | normal
title | block | heading
intro | block | para
slab | span | normal
counter | span | italic
`;
