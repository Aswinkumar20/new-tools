import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClipboardViewerComponent } from './clipboard-viewer';

describe('ClipboardViewerComponent', () => {
  let component: ClipboardViewerComponent;
  let fixture: ComponentFixture<ClipboardViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClipboardViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ClipboardViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
