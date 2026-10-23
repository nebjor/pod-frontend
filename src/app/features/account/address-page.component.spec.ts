import { HttpErrorResponse } from '@angular/common/http';
import { computed, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { FALLBACK_ORDER_SETTINGS } from '@core/order/order.models';
import { OrderService } from '@core/order/order.service';
import { AddressPageComponent } from './address-page.component';
import { AccountResponse } from '@core/account/account.models';
import { AccountService } from '@core/account/account.service';

const anna: AccountResponse = {
    email: 'anna@example.com',
    name: 'Anna Muster',
    street: 'Bahnhofstrasse 1',
    postalCode: '8001',
    city: 'Zürich',
    country: 'CH',
    createdAt: '2026-10-01T09:00:00Z',
    lastLoginAt: '2026-10-20T09:00:00Z'
};

describe('AddressPageComponent', () => {
    let fixture: ComponentFixture<AddressPageComponent>;
    let component: AddressPageComponent;
    let account: ReturnType<typeof signal<AccountResponse | null>>;
    let update: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        account = signal<AccountResponse | null>(anna);
        update = vi.fn((address: Partial<AccountResponse>) => {
            const updated = { ...anna, ...address };
            account.set(updated);
            return of(updated);
        });
    });

    async function setup() {
        await TestBed.configureTestingModule({
            imports: [AddressPageComponent],
            providers: [
                provideRouter([]),
                { provide: AccountService, useValue: { account, isSignedIn: computed(() => account() !== null), update } },
                { provide: OrderService, useValue: { loadSettings: () => of(FALLBACK_ORDER_SETTINGS) } }
            ]
        }).compileComponents();
        fixture = TestBed.createComponent(AddressPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    function element() {
        return fixture.nativeElement as HTMLElement;
    }

    it('is titled "Lieferadresse" and notes that the checkout is prefilled', async () => {
        await setup();

        expect(element().querySelector('h1')?.textContent?.trim()).toBe('Lieferadresse');
        expect(element().textContent).toContain('Wird im Checkout vorausgefüllt.');
    });

    it('fills the form from the account and saves it', async () => {
        await setup();

        expect(component.addressForm.getRawValue()).toEqual({
            name: 'Anna Muster',
            street: 'Bahnhofstrasse 1',
            postalCode: '8001',
            city: 'Zürich',
            country: 'CH'
        });

        component.addressForm.controls.street.setValue('Seestrasse 2');
        component.addressForm.controls.postalCode.setValue('8002');
        component.save();
        fixture.detectChanges();

        expect(update).toHaveBeenCalledWith({ name: 'Anna Muster', street: 'Seestrasse 2', postalCode: '8002', city: 'Zürich', country: 'CH' });
        expect(component.saved()).toBe(true);
        expect(element().textContent).toContain('Adresse gespeichert.');
    });

    it('does not save an incomplete address', async () => {
        await setup();
        component.addressForm.controls.city.setValue('');

        component.save();

        expect(update).not.toHaveBeenCalled();
        expect(component.addressForm.controls.city.touched).toBe(true);
    });

    it('shows the backend field errors next to the inputs', async () => {
        update.mockReturnValue(
            throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { postalCode: 'must be a Swiss postal code' } } }))
        );
        await setup();

        component.save();
        fixture.detectChanges();

        expect(component.fieldError('postalCode')).toBe('must be a Swiss postal code');
        expect(component.errorMessage()).toContain('markierten Felder');
        expect(element().textContent).toContain('must be a Swiss postal code');
        expect(component.saved()).toBe(false);
    });

    it('shows a general error when saving fails', async () => {
        update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
        await setup();

        component.save();
        fixture.detectChanges();

        expect(element().querySelector('.error')?.textContent).toBeTruthy();
        expect(component.saving()).toBe(false);
    });
});
