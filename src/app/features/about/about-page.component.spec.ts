import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AboutPageComponent } from './about-page.component';

describe('AboutPageComponent', () => {
    it('names the place of production and the ZHAW origin', async () => {
        await TestBed.configureTestingModule({ imports: [AboutPageComponent], providers: [provideRouter([])] }).compileComponents();
        const fixture = TestBed.createComponent(AboutPageComponent);
        fixture.detectChanges();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('Winterthur');
        expect(text).toContain('ZHAW');
        expect(fixture.nativeElement.querySelector('a[href="mailto:info@3dburg.ch"]')).not.toBeNull();
        expect(fixture.nativeElement.querySelector('img[src="/zhaw-logo.png"]')).not.toBeNull();
    });
});
