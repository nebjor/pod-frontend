import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '../i18n/translate.pipe';
import { ModelViewerComponent } from '../model-viewer/model-viewer.component';

@Component({
  selector: 'app-landing',
  imports: [ModelViewerComponent, TranslatePipe],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  constructor(private readonly router: Router) { }

  goToUpload() {
    this.router.navigate(['/upload']);
  }
}
