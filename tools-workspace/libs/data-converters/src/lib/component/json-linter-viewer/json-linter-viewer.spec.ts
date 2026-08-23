import { ComponentFixture, TestBed } from '@angular/core/testing';
import { JsonLinterViewerComponent } from './json-linter-viewer';

describe('JsonLinterViewerComponent', () => {
  let component: JsonLinterViewerComponent;
  let fixture: ComponentFixture<JsonLinterViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JsonLinterViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(JsonLinterViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
