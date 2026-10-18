import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-header',
  imports: [MatToolbarModule, MatButtonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  constructor(private readonly router: Router) { }

  goHome() {
    this.router.navigate(['/']);
  }

  goToUpload() {
    this.router.navigate(['/upload']);
  }

  goToHowItWorks() {
    this.router.navigate(['/'], { fragment: 'how-it-works' });
  }

  goToCheckout() {
    this.router.navigate(['/checkout']);
  }
}
