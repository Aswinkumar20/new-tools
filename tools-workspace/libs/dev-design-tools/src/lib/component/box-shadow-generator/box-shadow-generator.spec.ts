import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { BoxShadowGeneratorComponent } from './box-shadow-generator';

describe('BoxShadowGeneratorComponent', () => {
  let component: BoxShadowGeneratorComponent;
  let fixture: ComponentFixture<BoxShadowGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BoxShadowGeneratorComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(BoxShadowGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
