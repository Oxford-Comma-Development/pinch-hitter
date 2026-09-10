import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    title: 'Pinch Hitter',
  },
  {
    path: 'roster',
    loadComponent: () => import('./roster/roster.component').then((m) => m.RosterComponent),
    title: 'Roster · Pinch Hitter',
  },
  {
    path: 'practice',
    loadComponent: () => import('./practice/practice.component').then((m) => m.PracticeComponent),
    title: 'Batting Practice · Pinch Hitter',
  },
  {
    path: 'reports',
    loadComponent: () => import('./reports/reports.component').then((m) => m.ReportsComponent),
    title: 'Reports · Pinch Hitter',
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Settings · Pinch Hitter',
  },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy/privacy.component').then((m) => m.PrivacyComponent),
    title: 'Privacy Policy · Pinch Hitter',
  },
  {
    path: 'privacy.html',
    redirectTo: 'privacy',
  },
  { path: '**', redirectTo: '' },
];
