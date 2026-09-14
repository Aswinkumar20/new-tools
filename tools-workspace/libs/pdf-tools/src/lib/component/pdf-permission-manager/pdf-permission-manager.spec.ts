import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { PdfPermissionManagerComponent } from './pdf-permission-manager';

describe('PdfPermissionManagerComponent', () => {
  let fixture: ComponentFixture<PdfPermissionManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PdfPermissionManagerComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PdfPermissionManagerComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
