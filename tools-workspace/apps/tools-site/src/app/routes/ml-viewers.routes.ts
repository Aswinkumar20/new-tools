import { Routes } from '@angular/router';

export const ML_VIEWERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'onnx-viewer',
    loadComponent: () =>
      import('@tools-workspace/ml-viewers/onnx-viewer/onnx-viewer').then(m => m.OnnxViewerComponent),
  },
  {
    path: 'tensorflow-graph-viewer',
    loadComponent: () =>
      import('@tools-workspace/ml-viewers/tensorflow-graph-viewer/tensorflow-graph-viewer').then(m => m.TensorflowGraphViewerComponent),
  },
  {
    path: 'pytorch-model-viewer',
    loadComponent: () =>
      import('@tools-workspace/ml-viewers/pytorch-model-viewer/pytorch-model-viewer').then(m => m.PytorchModelViewerComponent),
  },
  {
    path: 'keras-model-viewer',
    loadComponent: () =>
      import('@tools-workspace/ml-viewers/keras-model-viewer/keras-model-viewer').then(m => m.KerasModelViewerComponent),
  },
  {
    path: 'mlflow-model-viewer',
    loadComponent: () =>
      import('@tools-workspace/ml-viewers/mlflow-model-viewer/mlflow-model-viewer').then(m => m.MlflowModelViewerComponent),
  },
  {
    path: 'neural-network-graph-viewer',
    loadComponent: () =>
      import('@tools-workspace/ml-viewers/neural-network-graph-viewer/neural-network-graph-viewer').then(m => m.NeuralNetworkGraphViewerComponent),
  },
  {
    path: 'model-architecture-viewer',
    loadComponent: () =>
      import('@tools-workspace/ml-viewers/model-architecture-viewer/model-architecture-viewer').then(m => m.ModelArchitectureViewerComponent),
  },
  {
    path: 'tensor-visualization-viewer',
    loadComponent: () =>
      import('@tools-workspace/ml-viewers/tensor-visualization-viewer/tensor-visualization-viewer').then(m => m.TensorVisualizationViewerComponent),
  },
  {
    path: 'pickle-viewer',
    loadComponent: () =>
      import('@tools-workspace/ml-viewers/pickle-viewer/pickle-viewer').then(m => m.PickleViewerComponent),
  },
];
