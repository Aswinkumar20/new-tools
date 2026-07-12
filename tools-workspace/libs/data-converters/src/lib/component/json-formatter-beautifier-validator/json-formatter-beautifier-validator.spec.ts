import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JsonFormatterBeautifierValidatorComponent } from './json-formatter-beautifier-validator';
import { converterTestProviders } from '../../shared/converter-test.utils';

describe('JsonFormatterBeautifierValidatorComponent', () => {
  let component: JsonFormatterBeautifierValidatorComponent;
  let fixture: ComponentFixture<JsonFormatterBeautifierValidatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonFormatterBeautifierValidatorComponent],
      providers: converterTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(JsonFormatterBeautifierValidatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
