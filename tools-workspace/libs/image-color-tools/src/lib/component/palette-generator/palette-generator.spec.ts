import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ictToolTestProviders } from '../../shared/ict-tool-test.utils';
import { PaletteGeneratorComponent } from './palette-generator';

describe('PaletteGeneratorComponent', () => {
  let component: PaletteGeneratorComponent;
  let fixture: ComponentFixture<PaletteGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaletteGeneratorComponent],
      providers: ictToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(PaletteGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
