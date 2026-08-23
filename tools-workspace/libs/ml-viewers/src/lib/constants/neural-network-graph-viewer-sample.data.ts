/** Synthetic ShopRanker neural-network graph snippets (education / research). */

export const NN_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "framework": "generic",
  "layers": [
    { "name": "features", "type": "Input", "units": 4 },
    { "name": "gemm1", "type": "Linear", "units": 8, "activation": "linear" },
    { "name": "relu1", "type": "ReLU", "activation": "relu" },
    { "name": "gemm2", "type": "Linear", "units": 3, "activation": "linear" },
    { "name": "scores", "type": "Softmax", "activation": "softmax" }
  ],
  "connections": [
    { "source": "features", "target": "gemm1" },
    { "source": "gemm1", "target": "relu1" },
    { "source": "relu1", "target": "gemm2" },
    { "source": "gemm2", "target": "scores" }
  ]
}
`;

export const NN_CSV_SAMPLE = `name,type,units,activation
features,Input,4,
gemm1,Linear,8,linear
relu1,ReLU,,relu
gemm2,Linear,3,linear
scores,Softmax,,softmax
`;

export const NN_MARKDOWN_SAMPLE = `# ShopRanker

name: STRING
type: STRING
units: STRING
activation: STRING

features | Input | 4 | 
gemm1 | Linear | 8 | linear
relu1 | ReLU |  | relu
gemm2 | Linear | 3 | linear
scores | Softmax |  | softmax
`;
