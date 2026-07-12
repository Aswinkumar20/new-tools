import { ComponentFixture, TestBed } from '@angular/core/testing';
import { stToolTestProviders } from '../../shared/st-tool-test.utils';
import { UuidGeneratorComponent } from './uuid-generator';

describe('UuidGeneratorComponent', () => {
  let component: UuidGeneratorComponent;
  let fixture: ComponentFixture<UuidGeneratorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UuidGeneratorComponent],
      providers: stToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(UuidGeneratorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
