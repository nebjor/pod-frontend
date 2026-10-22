import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { AboutComponent } from './about.component';

describe('AboutComponent', () => {
    it('names the place of production and the ZHAW origin', async () => {
        await TestBed.configureTestingModule({ imports: [AboutComponent], providers: [provideRouter([])] }).compileComponents();
        const fixture = TestBed.createComponent(AboutComponent);
        fixture.detectChanges();

        const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
        expect(text).toContain('Winterthur');
        expect(text).toContain('ZHAW');
        expect(fixture.nativeElement.querySelector('a[href="mailto:info@3dburg.ch"]')).not.toBeNull();
    });
});
