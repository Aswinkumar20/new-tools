/** Synthetic ShopRanker Keras architecture snippets (education / research). */

export const KS_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "class_name": "Sequential",
  "keras_version": "3.5.0",
  "backend": "tensorflow",
  "layers": [
    { "name": "features", "type": "InputLayer", "inputShape": [null, 4], "outputShape": [null, 4] },
    { "name": "gemm1", "type": "Dense", "units": 8, "activation": "linear", "inputShape": [null, 4], "outputShape": [null, 8] },
    { "name": "relu1", "type": "ReLU", "activation": "relu", "inputShape": [null, 8], "outputShape": [null, 8] },
    { "name": "gemm2", "type": "Dense", "units": 3, "activation": "linear", "inputShape": [null, 8], "outputShape": [null, 3] },
    { "name": "scores", "type": "Softmax", "activation": "softmax", "inputShape": [null, 3], "outputShape": [null, 3] }
  ],
  "shapes": [
    { "name": "features", "kind": "input", "dtype": "float32", "shape": [null, 4], "layer": "features" },
    { "name": "gemm1/kernel", "kind": "weight", "dtype": "float32", "shape": [4, 8], "layer": "gemm1" },
    { "name": "gemm1/bias", "kind": "bias", "dtype": "float32", "shape": [8], "layer": "gemm1" },
    { "name": "gemm2/kernel", "kind": "weight", "dtype": "float32", "shape": [8, 3], "layer": "gemm2" },
    { "name": "gemm2/bias", "kind": "bias", "dtype": "float32", "shape": [3], "layer": "gemm2" },
    { "name": "scores", "kind": "output", "dtype": "float32", "shape": [null, 3], "layer": "scores" }
  ]
}
`;

export const KS_KERAS_CONFIG_SAMPLE = `{
  "class_name": "Sequential",
  "config": {
    "name": "ShopRanker",
    "layers": [
      { "class_name": "InputLayer", "config": { "name": "features", "batch_input_shape": [null, 4], "dtype": "float32" } },
      { "class_name": "Dense", "config": { "name": "gemm1", "units": 8, "activation": "linear" } },
      { "class_name": "ReLU", "config": { "name": "relu1" } },
      { "class_name": "Dense", "config": { "name": "gemm2", "units": 3, "activation": "linear" } },
      { "class_name": "Softmax", "config": { "name": "scores" } }
    ]
  },
  "keras_version": "3.5.0",
  "backend": "tensorflow"
}
`;

export const KS_CSV_SAMPLE = `name,type,units,activation,inputShape,outputShape
features,InputLayer,,,null×4,null×4
gemm1,Dense,8,linear,null×4,null×8
relu1,ReLU,relu,,null×8,null×8
gemm2,Dense,3,linear,null×8,null×3
scores,Softmax,softmax,,null×3,null×3
`;

export const KS_MARKDOWN_SAMPLE = `# ShopRanker

name: STRING
type: STRING
units: STRING
activation: STRING

features | InputLayer |  | 
gemm1 | Dense | 8 | linear
relu1 | ReLU |  | relu
gemm2 | Dense | 3 | linear
scores | Softmax |  | softmax
`;
