import { Routes } from '@angular/router';

export const CAD_VIEWERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'dwg-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/dwg-viewer/dwg-viewer').then(m => m.DwgViewerComponent),
  },
  {
    path: 'dxf-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/dxf-viewer/dxf-viewer').then(m => m.DxfViewerComponent),
  },
  {
    path: 'dwf-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/dwf-viewer/dwf-viewer').then(m => m.DwfViewerComponent),
  },
  {
    path: 'dgn-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/dgn-viewer/dgn-viewer').then(m => m.DgnViewerComponent),
  },
  {
    path: 'step-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/step-viewer/step-viewer').then(m => m.StepViewerComponent),
  },
  {
    path: 'iges-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/iges-viewer/iges-viewer').then(m => m.IgesViewerComponent),
  },
  {
    path: 'parasolid-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/parasolid-viewer/parasolid-viewer').then(m => m.ParasolidViewerComponent),
  },
  {
    path: 'catia-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/catia-viewer/catia-viewer').then(m => m.CatiaViewerComponent),
  },
  {
    path: 'solidworks-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/solidworks-viewer/solidworks-viewer').then(m => m.SolidworksViewerComponent),
  },
  {
    path: 'fusion-360-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/fusion-360-viewer/fusion-360-viewer').then(m => m.Fusion360ViewerComponent),
  },
  {
    path: 'inventor-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/inventor-viewer/inventor-viewer').then(m => m.InventorViewerComponent),
  },
  {
    path: 'creo-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/creo-viewer/creo-viewer').then(m => m.CreoViewerComponent),
  },
  {
    path: 'rhino-3dm-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/rhino-3dm-viewer/rhino-3dm-viewer').then(m => m.Rhino3dmViewerComponent),
  },
  {
    path: 'sketchup-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/sketchup-viewer/sketchup-viewer').then(m => m.SketchupViewerComponent),
  },
  {
    path: 'plt-plot-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/plt-plot-viewer/plt-plot-viewer').then(m => m.PltPlotViewerComponent),
  },
  {
    path: 'hpgl-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/hpgl-viewer/hpgl-viewer').then(m => m.HpglViewerComponent),
  },
  {
    path: 'gerber-file-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/gerber-file-viewer/gerber-file-viewer').then(m => m.GerberFileViewerComponent),
  },
  {
    path: 'pcb-layout-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/pcb-layout-viewer/pcb-layout-viewer').then(m => m.PcbLayoutViewerComponent),
  },
  {
    path: 'kicad-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/kicad-viewer/kicad-viewer').then(m => m.KiCadViewerComponent),
  },
  {
    path: 'eagle-pcb-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/eagle-pcb-viewer/eagle-pcb-viewer').then(m => m.EaglePcbViewerComponent),
  },
  {
    path: 'altium-pcb-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/altium-pcb-viewer/altium-pcb-viewer').then(m => m.AltiumPcbViewerComponent),
  },
  {
    path: 'gdsii-layout-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/gdsii-layout-viewer/gdsii-layout-viewer').then(m => m.GdsiiLayoutViewerComponent),
  },
  {
    path: 'ifc-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/ifc-viewer/ifc-viewer').then(m => m.IfcViewerComponent),
  },
  {
    path: 'revit-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/revit-viewer/revit-viewer').then(m => m.RevitViewerComponent),
  },
  {
    path: 'navisworks-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/navisworks-viewer/navisworks-viewer').then(m => m.NavisworksViewerComponent),
  },
  {
    path: 'bim-clash-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/bim-clash-viewer/bim-clash-viewer').then(m => m.BimClashViewerComponent),
  },
  {
    path: 'building-floor-plan-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/building-floor-plan-viewer/building-floor-plan-viewer').then(m => m.BuildingFloorPlanViewerComponent),
  },
  {
    path: 'mep-model-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/mep-model-viewer/mep-model-viewer').then(m => m.MepModelViewerComponent),
  },
  {
    path: 'structural-model-viewer',
    loadComponent: () =>
      import('@tools-workspace/cad-viewers/structural-model-viewer/structural-model-viewer').then(m => m.StructuralModelViewerComponent),
  },
];
