import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ddToolTestProviders } from '../../shared/dd-tool-test.utils';
import { BorderRadiusPreviewComponent } from './border-radius-preview';

describe('BorderRadiusPreviewComponent', () => {
  let component: BorderRadiusPreviewComponent;
  let fixture: ComponentFixture<BorderRadiusPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BorderRadiusPreviewComponent],
      providers: ddToolTestProviders(),
    }).compileComponents();

    fixture = TestBed.createComponent(BorderRadiusPreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
