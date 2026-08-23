/** Synthetic ShopRanker architecture summary snippets (education / research). */

export const MA_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "family": "mlp",
  "blocks": [
    { "name": "stem", "type": "Input", "role": "stem", "inFeatures": 4, "outFeatures": 4 },
    { "name": "encoder", "type": "MLP", "role": "encoder", "inFeatures": 4, "outFeatures": 8 },
    { "name": "head", "type": "Classifier", "role": "head", "inFeatures": 8, "outFeatures": 3 }
  ],
  "params": [
    { "name": "encoder.weight", "block": "encoder", "kind": "weight", "dtype": "float32", "shape": [8, 4] },
    { "name": "encoder.bias", "block": "encoder", "kind": "bias", "dtype": "float32", "shape": [8] },
    { "name": "head.weight", "block": "head", "kind": "weight", "dtype": "float32", "shape": [3, 8] },
    { "name": "head.bias", "block": "head", "kind": "bias", "dtype": "float32", "shape": [3] }
  ]
}
`;

export const MA_CSV_SAMPLE = `name,type,role,inFeatures,outFeatures
stem,Input,stem,4,4
encoder,MLP,encoder,4,8
head,Classifier,head,8,3
`;

export const MA_MARKDOWN_SAMPLE = `# ShopRanker

name: STRING
type: STRING
role: STRING
inFeatures: NUMBER
outFeatures: NUMBER

stem | Input | stem | 4 | 4
encoder | MLP | encoder | 4 | 8
head | Classifier | head | 8 | 3
`;
