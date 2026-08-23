/** Synthetic ShopRanker MLflow artifact snippets (education / research). */

export const MF_JSON_SAMPLE = `{
  "name": "ShopRanker",
  "artifactPath": "shop-ranker",
  "mlflowVersion": "2.16.0",
  "flavor": "keras",
  "utcCreated": "2026-01-15 10:00:00",
  "signature": {
    "inputs": [{ "name": "features", "type": "tensor", "dtype": "float32", "shape": [-1, 4] }],
    "outputs": [{ "name": "scores", "type": "tensor", "dtype": "float32", "shape": [-1, 3] }]
  },
  "files": [
    { "name": "MLmodel", "path": "MLmodel", "role": "manifest", "flavor": "—" },
    { "name": "conda.yaml", "path": "conda.yaml", "role": "env", "flavor": "python_function" },
    { "name": "requirements.txt", "path": "requirements.txt", "role": "env", "flavor": "python_function" },
    { "name": "model.keras", "path": "data/model.keras", "role": "model", "flavor": "keras" }
  ]
}
`;

export const MF_MLMODEL_SAMPLE = `artifact_path: shop-ranker
mlflow_version: 2.16.0
utc_time_created: '2026-01-15 10:00:00.000000'
flavors:
  python_function:
    loader_module: mlflow.keras
    python_version: 3.11.9
    data: data
  keras:
    keras_version: 3.5.0
    data: data
    save_format: keras
signature:
  inputs: '[{"name":"features","type":"tensor","tensor-spec":{"dtype":"float32","shape":[-1,4]}}]'
  outputs: '[{"name":"scores","type":"tensor","tensor-spec":{"dtype":"float32","shape":[-1,3]}}]'
`;

export const MF_CONDA_SAMPLE = `name: shop-ranker-env
channels:
  - conda-forge
dependencies:
  - python=3.11.9
  - keras=3.5.0
`;

export const MF_CSV_SAMPLE = `name,kind,type,dtype,shape
features,input,tensor,float32,-1×4
scores,output,tensor,float32,-1×3
`;

export const MF_MARKDOWN_SAMPLE = `# ShopRanker

name: STRING
kind: STRING
type: STRING
dtype: STRING
shape: STRING

features | input | tensor | float32 | -1×4
scores | output | tensor | float32 | -1×3
`;
