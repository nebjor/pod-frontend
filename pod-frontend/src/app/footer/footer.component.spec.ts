import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FooterComponent } from './footer.component';

describe('FooterComponent', () => {
    let fixture: ComponentFixture<FooterComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [FooterComponent],
            providers: [provideRouter([])]
        }).compileComponents();

        fixture = TestBed.createComponent(FooterComponent);
        await fixture.whenStable();
    });

    it('links the legal pages and names the business', () => {
        const element = fixture.nativeElement as HTMLElement;
        const hrefs = Array.from(element.querySelectorAll('a')).map((a) => a.getAttribute('href'));

        expect(hrefs).toEqual(expect.arrayContaining(['/impressum', '/agb', '/datenschutz']));
        expect(element.textContent).toContain('3DBurg');
        expect(element.textContent).toContain('info@3dburg.ch');
    });
});
