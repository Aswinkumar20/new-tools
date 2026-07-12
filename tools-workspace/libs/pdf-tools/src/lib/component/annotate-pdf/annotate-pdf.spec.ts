import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { AnnotatePdfComponent } from './annotate-pdf';

describe('AnnotatePdfComponent', () => {
  let component: AnnotatePdfComponent;
  let fixture: ComponentFixture<AnnotatePdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AnnotatePdfComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotatePdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
