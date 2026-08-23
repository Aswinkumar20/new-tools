import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ExtractPagesComponent } from './extract-pages';

describe('ExtractPagesComponent', () => {
  let component: ExtractPagesComponent;
  let fixture: ComponentFixture<ExtractPagesComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExtractPagesComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(ExtractPagesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
