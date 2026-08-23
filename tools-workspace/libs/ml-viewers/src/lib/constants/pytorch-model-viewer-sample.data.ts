/** Synthetic ShopRanker PyTorch checkpoint snippets (education / research). */

export const PT_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "format": "torch.nn",
  "torchVersion": "2.4.0",
  "layers": [
    { "name": "gemm1", "type": "Linear", "inFeatures": 4, "outFeatures": 8 },
    { "name": "relu1", "type": "ReLU" },
    { "name": "gemm2", "type": "Linear", "inFeatures": 8, "outFeatures": 3 },
    { "name": "softmax", "type": "Softmax" }
  ],
  "params": [
    { "name": "gemm1.weight", "layer": "gemm1", "kind": "weight", "dtype": "float32", "shape": [8, 4] },
    { "name": "gemm1.bias", "layer": "gemm1", "kind": "bias", "dtype": "float32", "shape": [8] },
    { "name": "gemm2.weight", "layer": "gemm2", "kind": "weight", "dtype": "float32", "shape": [3, 8] },
    { "name": "gemm2.bias", "layer": "gemm2", "kind": "bias", "dtype": "float32", "shape": [3] }
  ]
}
`;

export const PT_CSV_SAMPLE = `name,type,inFeatures,outFeatures
gemm1,Linear,4,8
relu1,ReLU,,
gemm2,Linear,8,3
softmax,Softmax,,
`;

export const PT_MARKDOWN_SAMPLE = `# ShopRanker

name: STRING
type: STRING
inFeatures: NUMBER
outFeatures: NUMBER

gemm1 | Linear | 4 | 8
relu1 | ReLU |  | 
gemm2 | Linear | 8 | 3
softmax | Softmax |  | 
`;
