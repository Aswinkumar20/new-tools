import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { AddPageNumbersComponent } from './add-page-numbers';

describe('AddPageNumbersComponent', () => {
  let fixture: ComponentFixture<AddPageNumbersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddPageNumbersComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(AddPageNumbersComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });
});
