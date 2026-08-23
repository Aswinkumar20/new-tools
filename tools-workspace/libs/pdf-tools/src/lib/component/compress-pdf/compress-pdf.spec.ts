import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CompressPdfComponent } from './compress-pdf';

describe('CompressPdfComponent', () => {
  let component: CompressPdfComponent;
  let fixture: ComponentFixture<CompressPdfComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompressPdfComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(CompressPdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
