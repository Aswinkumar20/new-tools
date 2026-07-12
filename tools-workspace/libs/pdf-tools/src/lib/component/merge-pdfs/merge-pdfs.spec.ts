import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { MergePdfsComponent } from './merge-pdfs';

describe('MergePdfsComponent', () => {
  let component: MergePdfsComponent;
  let fixture: ComponentFixture<MergePdfsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MergePdfsComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(MergePdfsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
