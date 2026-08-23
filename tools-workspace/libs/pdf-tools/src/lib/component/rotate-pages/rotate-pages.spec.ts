import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { RotatePagesComponent } from './rotate-pages';

describe('RotatePagesComponent', () => {
  let component: RotatePagesComponent;
  let fixture: ComponentFixture<RotatePagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RotatePagesComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(RotatePagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
