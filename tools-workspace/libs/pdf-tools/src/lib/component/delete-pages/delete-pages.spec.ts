import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { DeletePagesComponent } from './delete-pages';

describe('DeletePagesComponent', () => {
  let component: DeletePagesComponent;
  let fixture: ComponentFixture<DeletePagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeletePagesComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(DeletePagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
