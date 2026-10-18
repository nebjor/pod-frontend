import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { CheckoutComponent } from './checkout/checkout.component';
import { UploadComponent } from './upload/upload.component';

export const routes: Routes = [
    { path: '', component: LandingComponent },
    { path: 'upload', component: UploadComponent },
    { path: 'checkout', component: CheckoutComponent },
    { path: '**', redirectTo: '' }
];