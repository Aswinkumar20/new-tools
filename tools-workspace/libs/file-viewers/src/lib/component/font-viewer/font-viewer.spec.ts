import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FontViewerComponent } from './font-viewer';

describe('FontViewerComponent', () => {
  let component: FontViewerComponent;
  let fixture: ComponentFixture<FontViewerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FontViewerComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(FontViewerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
