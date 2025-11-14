import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ArchiveViewerComponent } from './archive-viewer';

describe('ArchiveViewerComponent', () => {
  let component: ArchiveViewerComponent;
  let fixture: ComponentFixture<ArchiveViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ArchiveViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ArchiveViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
