import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextFileViewerComponent } from './text-file-viewer';

describe('TextFileViewerComponent', () => {
  let component: TextFileViewerComponent;
  let fixture: ComponentFixture<TextFileViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TextFileViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(TextFileViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
