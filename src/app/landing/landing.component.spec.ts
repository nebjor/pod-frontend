import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the preview, the photo of the printed part and one call to action between them', () => {
    const host = fixture.nativeElement as HTMLElement;
    const showcase = host.querySelector('.hero-showcase');
    expect(showcase?.querySelector('app-model-viewer')).not.toBeNull();
    expect(showcase?.querySelector('img')?.getAttribute('src')).toBe('/benchy-print.jpg');
    expect(showcase?.querySelectorAll('.primary-btn')).toHaveLength(1);
  });
});
