import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StorageViewerComponent } from './storage-viewer';

describe('StorageViewerComponent', () => {
  let component: StorageViewerComponent;
  let fixture: ComponentFixture<StorageViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StorageViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(StorageViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
