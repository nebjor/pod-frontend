import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OrderService } from '@core/order/order.service';
import { MockPaymentPageComponent } from './mock-payment-page.component';

describe('MockPaymentPageComponent', () => {
    let fixture: ComponentFixture<MockPaymentPageComponent>;
    let component: MockPaymentPageComponent;
    let completeMockPayment: ReturnType<typeof vi.fn>;
    let navigate: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
        completeMockPayment = vi.fn(() => of({ orderNumber: 'POD-1000', status: 'PAID' }));
        const params: Record<string, string> = { session: 'mock_1', order: 'POD-1000', amount: '20.00', currency: 'CHF' };

        await TestBed.configureTestingModule({
            imports: [MockPaymentPageComponent],
            providers: [
                provideRouter([]),
                { provide: OrderService, useValue: { completeMockPayment } },
                { provide: ActivatedRoute, useValue: { queryParamMap: of({ get: (key: string) => params[key] ?? null }) } }
            ]
        }).compileComponents();

        navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        fixture = TestBed.createComponent(MockPaymentPageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('shows what is being paid', () => {
        expect(component.orderNumber()).toBe('POD-1000');
        expect(component.amount()).toBe(20);
        expect((fixture.nativeElement as HTMLElement).textContent).toContain('CHF 20.00');
    });

    it('confirms through the backend and continues to the success page', () => {
        component.pay();

        expect(completeMockPayment).toHaveBeenCalledWith('mock_1');
        expect(navigate).toHaveBeenCalledWith(['/checkout/success'], { queryParams: { order: 'POD-1000' } });
    });

    it('shows an error when the backend rejects the session', () => {
        completeMockPayment.mockReturnValueOnce(
            throwError(() => new HttpErrorResponse({ status: 404, error: { detail: 'Unknown payment session.' } }))
        );

        component.pay();

        expect(component.paying()).toBe(false);
        expect(component.errorMessage()).toContain('Unknown payment session');
        expect(navigate).not.toHaveBeenCalled();
    });

    it('cancelling returns to the shop with the order marked as cancelled', () => {
        component.cancel();

        expect(navigate).toHaveBeenCalledWith(['/checkout/success'], { queryParams: { order: 'POD-1000', cancelled: 1 } });
    });
});
