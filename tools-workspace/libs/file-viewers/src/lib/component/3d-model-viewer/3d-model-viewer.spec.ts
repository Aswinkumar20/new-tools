import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Model3dViewerComponent } from './3d-model-viewer';

describe('Model3dViewerComponent', () => {
  let component: Model3dViewerComponent;
  let fixture: ComponentFixture<Model3dViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Model3dViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(Model3dViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
