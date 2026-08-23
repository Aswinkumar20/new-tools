import { Routes } from '@angular/router';

export const SCIENCE_VIEWERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'hdf5-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/hdf5-viewer/hdf5-viewer').then(m => m.Hdf5ViewerComponent),
  },
  {
    path: 'netcdf-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/netcdf-viewer/netcdf-viewer').then(m => m.NetcdfViewerComponent),
  },
  {
    path: 'fits-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/fits-viewer/fits-viewer').then(m => m.FitsViewerComponent),
  },
  {
    path: 'grib-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/grib-viewer/grib-viewer').then(m => m.GribViewerComponent),
  },
  {
    path: 'matlab-mat-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/matlab-mat-viewer/matlab-mat-viewer').then(m => m.MatlabMatViewerComponent),
  },
  {
    path: 'root-file-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/root-file-viewer/root-file-viewer').then(m => m.RootFileViewerComponent),
  },
  {
    path: 'molecular-structure-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/molecular-structure-viewer/molecular-structure-viewer').then(m => m.MolecularStructureViewerComponent),
  },
  {
    path: 'protein-structure-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/protein-structure-viewer/protein-structure-viewer').then(m => m.ProteinStructureViewerComponent),
  },
  {
    path: 'fasta-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/fasta-viewer/fasta-viewer').then(m => m.FastaViewerComponent),
  },
  {
    path: 'fastq-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/fastq-viewer/fastq-viewer').then(m => m.FastqViewerComponent),
  },
  {
    path: 'genbank-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/genbank-viewer/genbank-viewer').then(m => m.GenbankViewerComponent),
  },
  {
    path: 'vcf-variant-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/vcf-variant-viewer/vcf-variant-viewer').then(m => m.VcfVariantViewerComponent),
  },
  {
    path: 'las-well-log-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/las-well-log-viewer/las-well-log-viewer').then(m => m.LasWellLogViewerComponent),
  },
  {
    path: 'dlis-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/dlis-viewer/dlis-viewer').then(m => m.DlisViewerComponent),
  },
  {
    path: 'seg-y-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/seg-y-viewer/seg-y-viewer').then(m => m.SegYViewerComponent),
  },
  {
    path: 'geological-model-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/geological-model-viewer/geological-model-viewer').then(m => m.GeologicalModelViewerComponent),
  },
  {
    path: 'borehole-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/borehole-viewer/borehole-viewer').then(m => m.BoreholeViewerComponent),
  },
  {
    path: 'stratigraphy-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/stratigraphy-viewer/stratigraphy-viewer').then(m => m.StratigraphyViewerComponent),
  },
  {
    path: 'climate-data-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/climate-data-viewer/climate-data-viewer').then(m => m.ClimateDataViewerComponent),
  },
  {
    path: 'simulation-result-viewer',
    loadComponent: () =>
      import('@tools-workspace/science-viewers/simulation-result-viewer/simulation-result-viewer').then(m => m.SimulationResultViewerComponent),
  },
];
