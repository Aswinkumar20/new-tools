import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { Model3dBackendApiService } from '../../api/model3d-backend-api.service';
import { Model3dViewerComponent } from './3d-model-viewer';

describe('Model3dViewerComponent', () => {
  let component: Model3dViewerComponent;
  let fixture: ComponentFixture<Model3dViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Model3dViewerComponent],
      providers: [
        ...fileViewerTestProviders(),
        provideRouter([]),
        {
          provide: Model3dBackendApiService,
          useValue: {
            settings: { enabled: true, baseUrl: '/api/v1/model3d', maxUploadMb: 50 },
            health: () => of({ status: 'UP', service: 'tool-api-model3d', version: '0.1.0' }),
            inspect: jest.fn(),
            normalize: jest.fn()
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Model3dViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create a live viewer shell with format chips', () => {
    expect(component).toBeTruthy();
    expect(component.formatsCountLabel).toBe('4');
    expect(component.capabilityLine).toContain('GLB');
    expect(component.apiReachable).toBe(true);
    expect(component.statusLabel).toBe('Idle');
  });

  it('shows upload suggestion when idle and API is up', () => {
    expect(component.primarySuggestion?.id).toBe('m3d-upload');
    component.dismissSuggestion('m3d-upload');
    expect(component.primarySuggestion).toBeNull();
  });
});

describe('Model3dViewerComponent API offline', () => {
  it('marks API unreachable when health fails', async () => {
    await TestBed.configureTestingModule({
      imports: [Model3dViewerComponent],
      providers: [
        ...fileViewerTestProviders(),
        provideRouter([]),
        {
          provide: Model3dBackendApiService,
          useValue: {
            settings: { enabled: true, baseUrl: '/api/v1/model3d', maxUploadMb: 50 },
            health: () => throwError(() => new Error('offline')),
            inspect: jest.fn(),
            normalize: jest.fn()
          }
        }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(Model3dViewerComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.apiReachable).toBe(false);
    expect(component.statusLabel).toBe('Unavailable');
  });
});
