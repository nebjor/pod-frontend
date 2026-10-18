import { Component } from '@angular/core';

@Component({
    selector: 'app-checkout',
    standalone: true,
    template: `
    <section class="checkout-page">
      <h1>Checkout</h1>
      <p>Hier geht direkt der Checkout-Flow los.</p>
    </section>
  `,
    styles: [`
    .checkout-page {
      max-width: 980px;
      margin: 0 auto;
      padding: 3rem 1rem 5rem;
      color: var(--text-100);
    }

    h1 {
      margin: 0;
      font-size: clamp(1.8rem, 4vw, 2.8rem);
    }

    p {
      margin: 0.8rem 0 0;
      color: var(--text-300);
      font-size: 1.05rem;
    }
  `]
})
export class CheckoutComponent { }
