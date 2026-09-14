import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { MultiPdfChatComponent } from './multi-pdf-chat';

describe('MultiPdfChatComponent', () => {
  let fixture: ComponentFixture<MultiPdfChatComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MultiPdfChatComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(MultiPdfChatComponent);
    fixture.detectChanges();
  });

  it('should create the tool workbench wrapper', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
