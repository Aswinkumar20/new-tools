import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfOrganizerComponent } from './pdf-organizer';

describe('PdfOrganizerComponent', () => {
  let fixture: ComponentFixture<PdfOrganizerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfOrganizerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfOrganizerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
