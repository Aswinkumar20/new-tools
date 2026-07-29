import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';
import { Model3dViewerComponent } from './3d-model-viewer';

describe('Model3dViewerComponent', () => {
  let component: Model3dViewerComponent;
  let fixture: ComponentFixture<Model3dViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Model3dViewerComponent],
      providers: [...fileViewerTestProviders(), provideRouter([])]
    }).compileComponents();

    fixture = TestBed.createComponent(Model3dViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create as a coming-soon shell with planned formats', () => {
    expect(component).toBeTruthy();
    expect(component.statusLabel).toBe('Soon');
    expect(component.formatsCountLabel).toBe('5+');
    expect(component.capabilityLine).toContain('GLTF');
    expect(component.roadmapItems.length).toBe(3);
    expect(component.relatedTools.length).toBeGreaterThan(0);
  });

  it('shows and dismisses the texture-preview suggestion', () => {
    expect(component.primarySuggestion()?.id).toBe('m3d-textures');
    const suggestion = component.primarySuggestion();
    if (suggestion) {
      component.dismissSuggestion(suggestion.id);
      expect(component.primarySuggestion()).toBeNull();
    }
  });
});
