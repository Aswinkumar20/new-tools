import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JsonLinterViewerComponent } from './json-linter-viewer';
import { converterTestProviders } from '../../shared/converter-test.utils';

describe('JsonLinterViewerComponent', () => {
  let component: JsonLinterViewerComponent;
  let fixture: ComponentFixture<JsonLinterViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonLinterViewerComponent],
      providers: converterTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(JsonLinterViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
