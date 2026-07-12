import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { CreatePdfFromHtmlComponent } from './create-pdf-from-html';

describe('CreatePdfFromHtmlComponent', () => {
  let component: CreatePdfFromHtmlComponent;
  let fixture: ComponentFixture<CreatePdfFromHtmlComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreatePdfFromHtmlComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(CreatePdfFromHtmlComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
