import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownToHtmlComponent } from './markdown-to-html';

describe('MarkdownToHtmlComponent', () => {
  let component: MarkdownToHtmlComponent;
  let fixture: ComponentFixture<MarkdownToHtmlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownToHtmlComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownToHtmlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
