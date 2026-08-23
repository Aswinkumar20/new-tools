import { Routes } from '@angular/router';

export const PROCESS_VIEWERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'bpmn-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/bpmn-viewer/bpmn-viewer').then(m => m.BpmnViewerComponent),
  },
  {
    path: 'bpmn-analytics-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/bpmn-analytics-viewer/bpmn-analytics-viewer').then(m => m.BpmnAnalyticsViewerComponent),
  },
  {
    path: 'dmn-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/dmn-viewer/dmn-viewer').then(m => m.DmnViewerComponent),
  },
  {
    path: 'decision-model-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/decision-model-viewer/decision-model-viewer').then(m => m.DecisionModelViewerComponent),
  },
  {
    path: 'epc-diagram-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/epc-diagram-viewer/epc-diagram-viewer').then(m => m.EpcDiagramViewerComponent),
  },
  {
    path: 'pnml-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/pnml-viewer/pnml-viewer').then(m => m.PnmlViewerComponent),
  },
  {
    path: 'petri-net-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/petri-net-viewer/petri-net-viewer').then(m => m.PetriNetViewerComponent),
  },
  {
    path: 'bpel-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/bpel-viewer/bpel-viewer').then(m => m.BpelViewerComponent),
  },
  {
    path: 'workflow-diagram-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/workflow-diagram-viewer/workflow-diagram-viewer').then(m => m.WorkflowDiagramViewerComponent),
  },
  {
    path: 'process-map-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/process-map-viewer/process-map-viewer').then(m => m.ProcessMapViewerComponent),
  },
  {
    path: 'process-mining-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/process-mining-viewer/process-mining-viewer').then(m => m.ProcessMiningViewerComponent),
  },
  {
    path: 'event-log-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/event-log-viewer/event-log-viewer').then(m => m.EventLogViewerComponent),
  },
  {
    path: 'trace-explorer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/trace-explorer/trace-explorer').then(m => m.TraceExplorerComponent),
  },
  {
    path: 'process-timeline-viewer',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/process-timeline-viewer/process-timeline-viewer').then(m => m.ProcessTimelineViewerComponent),
  },
  {
    path: 'business-process-simulator',
    loadComponent: () =>
      import('@tools-workspace/process-viewers/business-process-simulator/business-process-simulator').then(m => m.BusinessProcessSimulatorComponent),
  },
];
