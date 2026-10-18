import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ModelViewerComponent } from '../model-viewer/model-viewer.component';

@Component({
  selector: 'app-landing',
  imports: [ModelViewerComponent],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss',
})
export class LandingComponent {
  constructor(private readonly router: Router) { }

  goToUpload() {
    this.router.navigate(['/upload']);
  }
}
