import { Routes } from '@angular/router';

export const MEDICAL_VIEWERS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../pages/category-index/category-index').then(m => m.CategoryIndexComponent),
  },
  {
    path: 'dicom-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/dicom-viewer/dicom-viewer').then(m => m.DicomViewerComponent),
  },
  {
    path: 'nifti-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/nifti-viewer/nifti-viewer').then(m => m.NiftiViewerComponent),
  },
  {
    path: 'mri-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/mri-viewer/mri-viewer').then(m => m.MriViewerComponent),
  },
  {
    path: 'ct-scan-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/ct-scan-viewer/ct-scan-viewer').then(m => m.CtScanViewerComponent),
  },
  {
    path: 'x-ray-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/x-ray-viewer/x-ray-viewer').then(m => m.XRayViewerComponent),
  },
  {
    path: 'ultrasound-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/ultrasound-viewer/ultrasound-viewer').then(m => m.UltrasoundViewerComponent),
  },
  {
    path: 'mammography-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/mammography-viewer/mammography-viewer').then(m => m.MammographyViewerComponent),
  },
  {
    path: 'pet-scan-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/pet-scan-viewer/pet-scan-viewer').then(m => m.PetScanViewerComponent),
  },
  {
    path: 'nrrd-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/nrrd-viewer/nrrd-viewer').then(m => m.NrrdViewerComponent),
  },
  {
    path: 'minc-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/minc-viewer/minc-viewer').then(m => m.MincViewerComponent),
  },
  {
    path: 'pathology-slide-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/pathology-slide-viewer/pathology-slide-viewer').then(m => m.PathologySlideViewerComponent),
  },
  {
    path: 'whole-slide-image-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/whole-slide-image-viewer/whole-slide-image-viewer').then(m => m.WholeSlideImageViewerComponent),
  },
  {
    path: 'ecg-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/ecg-viewer/ecg-viewer').then(m => m.EcgViewerComponent),
  },
  {
    path: 'eeg-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/eeg-viewer/eeg-viewer').then(m => m.EegViewerComponent),
  },
  {
    path: 'hl7-message-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/hl7-message-viewer/hl7-message-viewer').then(m => m.Hl7MessageViewerComponent),
  },
  {
    path: 'fhir-resource-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/fhir-resource-viewer/fhir-resource-viewer').then(m => m.FhirResourceViewerComponent),
  },
  {
    path: 'medical-timeline-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/medical-timeline-viewer/medical-timeline-viewer').then(m => m.MedicalTimelineViewerComponent),
  },
  {
    path: 'cda-viewer',
    loadComponent: () =>
      import('@tools-workspace/medical-viewers/cda-viewer/cda-viewer').then(m => m.CdaViewerComponent),
  },
];
