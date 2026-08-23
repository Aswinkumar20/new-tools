/** Synthetic ShopRanker ONNX snippets (education / research). */

export const OX_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "irVersion": 8,
  "producerName": "easytoolhub",
  "producerVersion": "0.1",
  "domain": "shop.ranker",
  "modelVersion": 1,
  "docString": "Tiny ranking MLP",
  "opset": 18,
  "nodes": [
    { "name": "gemm1", "opType": "Gemm", "inputs": ["features", "W1", "b1"], "outputs": ["h1"] },
    { "name": "relu1", "opType": "Relu", "inputs": ["h1"], "outputs": ["h1a"] },
    { "name": "gemm2", "opType": "Gemm", "inputs": ["h1a", "W2", "b2"], "outputs": ["logits"] },
    { "name": "softmax", "opType": "Softmax", "inputs": ["logits"], "outputs": ["scores"] }
  ],
  "tensors": [
    { "name": "features", "kind": "input", "dtype": "FLOAT", "shape": [1, 4] },
    { "name": "W1", "kind": "initializer", "dtype": "FLOAT", "shape": [4, 8] },
    { "name": "b1", "kind": "initializer", "dtype": "FLOAT", "shape": [8] },
    { "name": "W2", "kind": "initializer", "dtype": "FLOAT", "shape": [8, 3] },
    { "name": "b2", "kind": "initializer", "dtype": "FLOAT", "shape": [3] },
    { "name": "scores", "kind": "output", "dtype": "FLOAT", "shape": [1, 3] }
  ]
}
`;

export const OX_CSV_SAMPLE = `name,opType,inputs,outputs
gemm1,Gemm,"features|W1|b1",h1
relu1,Relu,h1,h1a
gemm2,Gemm,"h1a|W2|b2",logits
softmax,Softmax,logits,scores
`;

export const OX_MARKDOWN_SAMPLE = `# ShopRanker

name: STRING
opType: STRING
inputs: STRING
outputs: STRING

gemm1 | Gemm | features W1 b1 | h1
relu1 | Relu | h1 | h1a
gemm2 | Gemm | h1a W2 b2 | logits
softmax | Softmax | logits | scores
`;
