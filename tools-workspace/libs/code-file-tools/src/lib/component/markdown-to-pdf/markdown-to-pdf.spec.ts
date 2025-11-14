import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MarkdownToPdfComponent } from './markdown-to-pdf';

describe('MarkdownToPdfComponent', () => {
  let component: MarkdownToPdfComponent;
  let fixture: ComponentFixture<MarkdownToPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MarkdownToPdfComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(MarkdownToPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
