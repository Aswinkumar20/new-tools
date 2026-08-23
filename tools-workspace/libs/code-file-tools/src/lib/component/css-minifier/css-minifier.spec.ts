import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CssMinifierComponent } from './css-minifier';

describe('CssMinifierComponent', () => {
  let component: CssMinifierComponent;
  let fixture: ComponentFixture<CssMinifierComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CssMinifierComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CssMinifierComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
