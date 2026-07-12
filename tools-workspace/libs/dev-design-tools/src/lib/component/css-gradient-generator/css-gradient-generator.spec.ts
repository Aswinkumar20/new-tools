import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { CssGradientGeneratorComponent } from './css-gradient-generator';

describe('CssGradientGeneratorComponent', () => {
  let component: CssGradientGeneratorComponent;
  let fixture: ComponentFixture<CssGradientGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CssGradientGeneratorComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(CssGradientGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
