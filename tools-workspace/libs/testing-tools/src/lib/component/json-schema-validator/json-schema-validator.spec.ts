import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ttToolTestProviders } from '../../shared/tt-tool-test.utils';
import { JsonSchemaValidatorComponent } from './json-schema-validator';

describe('JsonSchemaValidatorComponent', () => {
  let component: JsonSchemaValidatorComponent;
  let fixture: ComponentFixture<JsonSchemaValidatorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonSchemaValidatorComponent],
      providers: ttToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(JsonSchemaValidatorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
