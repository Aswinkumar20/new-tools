import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AssetService, ToastService } from '@tools-workspace/features-home';
import { CdaViewerComponent } from './cda-viewer';

describe('CdaViewerComponent', () => {
  let fixture: ComponentFixture<CdaViewerComponent>;
  let component: CdaViewerComponent;
  const toast = { success: jest.fn(), error: jest.fn(), info: jest.fn() };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CdaViewerComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ToastService, useValue: toast },
        { provide: AssetService, useValue: { getAssetPath: (p: string) => `/assets/${p}` } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CdaViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('loads sample CCD document with sections', async () => {
    await component.loadSample();
    expect(component.currentDocument?.name).toBe('sample-ccd-document.xml');
    expect(component.currentDocument?.parsed.sections.length).toBe(3);
    expect(component.currentDocument?.parsed.patientName).toContain('John');
  });

  it('switches to narrative view when section selected', async () => {
    await component.loadSample();
    const section = component.filteredSections[0];
    component.selectSection(section);
    expect(component.viewMode).toBe('narrative');
    expect(component.selectedSectionId).toBe(section.id);
  });
});
