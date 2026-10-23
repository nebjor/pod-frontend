import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@core/i18n/translate.pipe';
import { ModelViewerComponent } from '@shared/model-viewer/model-viewer.component';

@Component({
  selector: 'app-landing-page',
  imports: [ModelViewerComponent, TranslatePipe],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.scss',
})
export class LandingPageComponent {
  constructor(private readonly router: Router) { }

  goToUpload() {
    this.router.navigate(['/upload']);
  }
}
