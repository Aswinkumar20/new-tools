/** Synthetic ShopRanker MOBI snippets (education / research). */

export const MB_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "title": "ShopRanker Handbook",
  "creator": "EasyToolHub",
  "language": "en",
  "mobiVer": "6",
  "chapters": [
    {
      "name": "ch1",
      "title": "Introduction",
      "href": "ch1.html",
      "text": "ShopRanker is a local handbook for the shop floor. The slab is twelve by eight metres."
    },
    {
      "name": "ch2",
      "title": "Shop floor",
      "href": "ch2.html",
      "text": "A column stands at ten, six. Keep the aisle clear along the centre line."
    }
  ],
  "toc": [
    { "label": "Introduction", "href": "ch1.html", "chapter": "ch1" },
    { "label": "Shop floor", "href": "ch2.html", "chapter": "ch2" }
  ],
  "meta": [
    { "name": "title", "value": "ShopRanker Handbook" },
    { "name": "creator", "value": "EasyToolHub" },
    { "name": "language", "value": "en" }
  ]
}
`;

export const MB_ASCII_SAMPLE = `MOBI dump ShopRanker 6
META title ShopRanker Handbook
META creator EasyToolHub
META language en
TOC ch1 Introduction
TOC ch2 Shop floor
CHAPTER ch1 Introduction
ShopRanker is a local handbook for the shop floor. The slab is twelve by eight metres.
CHAPTER ch2 Shop floor
A column stands at ten, six. Keep the aisle clear along the centre line.
`;

export const MB_AZW_SAMPLE = `AZW dump ShopRanker 8
META title ShopRanker Handbook
META creator EasyToolHub
META language en
TOC ch1 Introduction
TOC ch2 Shop floor
CHAPTER ch1 Introduction
ShopRanker is a local handbook for the shop floor. The slab is twelve by eight metres.
CHAPTER ch2 Shop floor
A column stands at ten, six. Keep the aisle clear along the centre line.
`;

export const MB_CSV_SAMPLE = `name,type,kind,chapter,toc,value
title,meta,,title,,ShopRanker Handbook
creator,meta,,creator,,EasyToolHub
language,meta,,language,,en
Introduction,toc,,ch1,Introduction,ch1
Shop floor,toc,,ch2,Shop floor,ch2
ch1,chapter,,ch1,Introduction,ShopRanker is a local handbook
ch2,chapter,,ch2,Shop floor,A column stands at ten
`;

export const MB_MARKDOWN_SAMPLE = `# ShopRanker Handbook

name: STRING
type: STRING
kind: STRING

title | meta | handbook
creator | meta | EasyToolHub
Introduction | toc | ch1
Shop floor | toc | ch2
ch1 | chapter | Introduction
ch2 | chapter | Shop floor
`;
