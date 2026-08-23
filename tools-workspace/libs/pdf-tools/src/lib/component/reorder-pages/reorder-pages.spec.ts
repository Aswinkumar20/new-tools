import { ComponentFixture, TestBed } from '@angular/core/testing';
import { pdfToolTestProviders } from '../../shared/pdf-tool-test.utils';
import { ReorderPagesComponent } from './reorder-pages';

describe('ReorderPagesComponent', () => {
  let component: ReorderPagesComponent;
  let fixture: ComponentFixture<ReorderPagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReorderPagesComponent],
      providers: pdfToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(ReorderPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
