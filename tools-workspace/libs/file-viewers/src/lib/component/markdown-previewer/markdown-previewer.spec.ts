import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownPreviewerComponent } from './markdown-previewer';

describe('MarkdownPreviewerComponent', () => {
  let component: MarkdownPreviewerComponent;
  let fixture: ComponentFixture<MarkdownPreviewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownPreviewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownPreviewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
