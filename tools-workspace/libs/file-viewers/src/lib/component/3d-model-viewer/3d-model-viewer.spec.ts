import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Model3dViewerComponent } from './3d-model-viewer';

import { fileViewerTestProviders } from '../../shared/file-viewer-test.utils';

describe('Model3dViewerComponent', () => {
  let component: Model3dViewerComponent;
  let fixture: ComponentFixture<Model3dViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Model3dViewerComponent],
      providers: fileViewerTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(Model3dViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
