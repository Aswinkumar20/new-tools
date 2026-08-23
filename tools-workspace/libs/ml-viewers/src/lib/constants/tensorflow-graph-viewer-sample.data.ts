/** Synthetic ShopRanker TensorFlow GraphDef snippets (education / research). */

export const TF_PBTXT_SAMPLE = `node { name: "features" op: "Placeholder" }
node { name: "W1" op: "Const" }
node { name: "b1" op: "Const" }
node { name: "gemm1" op: "MatMul" input: "features" input: "W1" }
node { name: "add1" op: "Add" input: "gemm1" input: "b1" }
node { name: "relu1" op: "Relu" input: "add1" }
node { name: "W2" op: "Const" }
node { name: "b2" op: "Const" }
node { name: "gemm2" op: "MatMul" input: "relu1" input: "W2" }
node { name: "add2" op: "Add" input: "gemm2" input: "b2" }
node { name: "scores" op: "Softmax" input: "add2" }
`;

export const TF_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "producer": "easytoolhub",
  "tfVersion": "2.16",
  "nodes": [
    { "name": "features", "op": "Placeholder" },
    { "name": "W1", "op": "Const" },
    { "name": "b1", "op": "Const" },
    { "name": "gemm1", "op": "MatMul", "inputs": ["features", "W1"] },
    { "name": "add1", "op": "Add", "inputs": ["gemm1", "b1"] },
    { "name": "relu1", "op": "Relu", "inputs": ["add1"] },
    { "name": "W2", "op": "Const" },
    { "name": "b2", "op": "Const" },
    { "name": "gemm2", "op": "MatMul", "inputs": ["relu1", "W2"] },
    { "name": "add2", "op": "Add", "inputs": ["gemm2", "b2"] },
    { "name": "scores", "op": "Softmax", "inputs": ["add2"] }
  ],
  "tensors": [
    { "name": "features", "kind": "placeholder", "dtype": "DT_FLOAT", "shape": [1, 4] },
    { "name": "W1", "kind": "constant", "dtype": "DT_FLOAT", "shape": [4, 8] },
    { "name": "b1", "kind": "constant", "dtype": "DT_FLOAT", "shape": [8] },
    { "name": "W2", "kind": "constant", "dtype": "DT_FLOAT", "shape": [8, 3] },
    { "name": "b2", "kind": "constant", "dtype": "DT_FLOAT", "shape": [3] },
    { "name": "scores", "kind": "output", "dtype": "DT_FLOAT", "shape": [1, 3] }
  ]
}
`;

export const TF_CSV_SAMPLE = `name,op,inputs
features,Placeholder,
gemm1,MatMul,"features|W1"
relu1,Relu,add1
gemm2,MatMul,"relu1|W2"
scores,Softmax,add2
`;

export const TF_MARKDOWN_SAMPLE = `# ShopRanker

name: STRING
op: STRING
inputs: STRING

features | Placeholder |
gemm1 | MatMul | features W1
relu1 | Relu | add1
gemm2 | MatMul | relu1 W2
scores | Softmax | add2
`;
