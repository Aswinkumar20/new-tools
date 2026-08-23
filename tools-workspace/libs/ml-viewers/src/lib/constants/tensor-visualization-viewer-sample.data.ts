/** Synthetic ShopRanker tensor dump snippets (education / research). */

export const TV_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "framework": "generic",
  "tensors": [
    { "name": "features", "kind": "input", "dtype": "float32", "shape": [null, 4], "min": 0, "max": 1, "mean": 0.42, "std": 0.21, "nnz": 4 },
    { "name": "gemm1/kernel", "kind": "weight", "dtype": "float32", "shape": [4, 8], "min": -0.42, "max": 0.51, "mean": 0.02, "std": 0.18, "nnz": 32 },
    { "name": "gemm1/bias", "kind": "bias", "dtype": "float32", "shape": [8], "min": -0.08, "max": 0.11, "mean": 0.01, "std": 0.06, "nnz": 8 },
    { "name": "gemm2/kernel", "kind": "weight", "dtype": "float32", "shape": [8, 3], "min": -0.55, "max": 0.48, "mean": -0.01, "std": 0.22, "nnz": 24 },
    { "name": "gemm2/bias", "kind": "bias", "dtype": "float32", "shape": [3], "min": -0.04, "max": 0.09, "mean": 0.02, "std": 0.05, "nnz": 3 },
    { "name": "scores", "kind": "output", "dtype": "float32", "shape": [null, 3], "min": 0.02, "max": 0.71, "mean": 0.33, "std": 0.28, "nnz": 3 }
  ]
}
`;

export const TV_CSV_SAMPLE = `name,kind,dtype,shape,min,max,mean,std,nnz
features,input,float32,"null,4",0,1,0.42,0.21,4
gemm1/kernel,weight,float32,"4,8",-0.42,0.51,0.02,0.18,32
gemm1/bias,bias,float32,8,-0.08,0.11,0.01,0.06,8
gemm2/kernel,weight,float32,"8,3",-0.55,0.48,-0.01,0.22,24
gemm2/bias,bias,float32,3,-0.04,0.09,0.02,0.05,3
scores,output,float32,"null,3",0.02,0.71,0.33,0.28,3
`;

export const TV_MARKDOWN_SAMPLE = `# ShopRanker

name: STRING
kind: STRING
dtype: STRING
shape: STRING

features | input | float32 | null,4
gemm1/kernel | weight | float32 | 4,8
gemm1/bias | bias | float32 | 8
gemm2/kernel | weight | float32 | 8,3
gemm2/bias | bias | float32 | 3
scores | output | float32 | null,3
`;
