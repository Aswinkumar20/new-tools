import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { FhirResourceViewerComponent } from './fhir-resource-viewer';

describe('FhirResourceViewerComponent', () => {
  let fixture: ComponentFixture<FhirResourceViewerComponent>;
  let component: FhirResourceViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FhirResourceViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        {
          provide: AssetService,
          useValue: { getAssetPath: (path: string) => `/assets/${path}` }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FhirResourceViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads sample FHIR Bundle with Patient and Observations', async () => {
    await component.loadSample();
    expect(component.currentResource?.name).toBe('sample-clinical-bundle.json');
    expect(component.currentResource?.parsed.resources.length).toBe(3);
    expect(component.currentResource?.parsed.references.length).toBeGreaterThan(0);
    expect(component.currentResource?.parsed.timeline.length).toBeGreaterThan(0);
  });

  it('switches between tree, references, and timeline tabs', async () => {
    await component.loadSample();
    component.setActiveTab('references');
    expect(component.activeTab).toBe('references');
    expect(component.filteredReferences.length).toBeGreaterThan(0);
    component.setActiveTab('timeline');
    expect(component.filteredTimeline.length).toBeGreaterThan(0);
  });

  it('searches the full tree including collapsed nodes', async () => {
    await component.loadSample();
    component.collapseAllTree();
    component.contentQuery = 'patient-001';
    component.onContentQueryChange();
    expect(component.visibleTreeRows.length).toBeGreaterThan(0);
    expect(
      component.visibleTreeRows.some(
        (row) =>
          String(row.node.value).includes('patient-001') ||
          row.node.path.toLowerCase().includes('patient')
      )
    ).toBe(true);
  });
});

