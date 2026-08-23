import { Routes } from '@angular/router';

export const DIAGRAM_VIEWERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'mermaid-diagram-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/mermaid-diagram-viewer/mermaid-diagram-viewer').then(m => m.MermaidDiagramViewerComponent),
  },
  {
    path: 'plantuml-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/plantuml-viewer/plantuml-viewer').then(m => m.PlantUmlViewerComponent),
  },
  {
    path: 'graphviz-dot-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/graphviz-dot-viewer/graphviz-dot-viewer').then(m => m.GraphvizDotViewerComponent),
  },
  {
    path: 'uml-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/uml-viewer/uml-viewer').then(m => m.UmlViewerComponent),
  },
  {
    path: 'class-diagram-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/class-diagram-viewer/class-diagram-viewer').then(m => m.ClassDiagramViewerComponent),
  },
  {
    path: 'sequence-diagram-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/sequence-diagram-viewer/sequence-diagram-viewer').then(m => m.SequenceDiagramViewerComponent),
  },
  {
    path: 'architecture-diagram-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/architecture-diagram-viewer/architecture-diagram-viewer').then(m => m.ArchitectureDiagramViewerComponent),
  },
  {
    path: 'c4-model-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/c4-model-viewer/c4-model-viewer').then(m => m.C4ModelViewerComponent),
  },
  {
    path: 'graphml-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/graphml-viewer/graphml-viewer').then(m => m.GraphmlViewerComponent),
  },
  {
    path: 'gexf-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/gexf-viewer/gexf-viewer').then(m => m.GexfViewerComponent),
  },
  {
    path: 'mind-map-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/mind-map-viewer/mind-map-viewer').then(m => m.MindMapViewerComponent),
  },
  {
    path: 'freemind-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/freemind-viewer/freemind-viewer').then(m => m.FreemindViewerComponent),
  },
  {
    path: 'freeplane-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/freeplane-viewer/freeplane-viewer').then(m => m.FreeplaneViewerComponent),
  },
  {
    path: 'concept-map-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/concept-map-viewer/concept-map-viewer').then(m => m.ConceptMapViewerComponent),
  },
  {
    path: 'er-diagram-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/er-diagram-viewer/er-diagram-viewer').then(m => m.ErDiagramViewerComponent),
  },
  {
    path: 'dbml-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/dbml-viewer/dbml-viewer').then(m => m.DbmlViewerComponent),
  },
  {
    path: 'sql-schema-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/sql-schema-viewer/sql-schema-viewer').then(m => m.SqlSchemaViewerComponent),
  },
  {
    path: 'prisma-schema-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/prisma-schema-viewer/prisma-schema-viewer').then(m => m.PrismaSchemaViewerComponent),
  },
  {
    path: 'draw-io-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/draw-io-viewer/draw-io-viewer').then(m => m.DrawIoViewerComponent),
  },
  {
    path: 'visio-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/visio-viewer/visio-viewer').then(m => m.VisioViewerComponent),
  },
  {
    path: 'terraform-graph-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/terraform-graph-viewer/terraform-graph-viewer').then(m => m.TerraformGraphViewerComponent),
  },
  {
    path: 'kubernetes-architecture-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/kubernetes-architecture-viewer/kubernetes-architecture-viewer').then(m => m.KubernetesArchitectureViewerComponent),
  },
  {
    path: 'dependency-graph-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/dependency-graph-viewer/dependency-graph-viewer').then(m => m.DependencyGraphViewerComponent),
  },
  {
    path: 'rdf-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/rdf-viewer/rdf-viewer').then(m => m.RdfViewerComponent),
  },
  {
    path: 'owl-ontology-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/owl-ontology-viewer/owl-ontology-viewer').then(m => m.OwlOntologyViewerComponent),
  },
  {
    path: 'knowledge-graph-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/knowledge-graph-viewer/knowledge-graph-viewer').then(m => m.KnowledgeGraphViewerComponent),
  },
  {
    path: 'state-machine-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/state-machine-viewer/state-machine-viewer').then(m => m.StateMachineViewerComponent),
  },
  {
    path: 'decision-tree-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/decision-tree-viewer/decision-tree-viewer').then(m => m.DecisionTreeViewerComponent),
  },
  {
    path: 'drools-rule-viewer',
    loadComponent: () =>
      import('@tools-workspace/diagram-viewers/drools-rule-viewer/drools-rule-viewer').then(m => m.DroolsRuleViewerComponent),
  },
];
