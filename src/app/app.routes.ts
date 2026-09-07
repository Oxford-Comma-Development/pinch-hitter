import { Routes } from '@angular/router';
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./home/home.component').then((m) => m.HomeComponent),
    title: 'Baseball Coach Helper',
  },
  {
    path: 'roster',
    loadComponent: () => import('./roster/roster.component').then((m) => m.RosterComponent),
    title: 'Roster · Coach Helper',
  },
  {
    path: 'practice',
    loadComponent: () => import('./practice/practice.component').then((m) => m.PracticeComponent),
    title: 'Batting Practice · Coach Helper',
  },
  {
    path: 'reports',
    loadComponent: () => import('./reports/reports.component').then((m) => m.ReportsComponent),
    title: 'Reports · Coach Helper',
  },
  {
    path: 'settings',
    loadComponent: () => import('./settings/settings.component').then((m) => m.SettingsComponent),
    title: 'Settings · Coach Helper',
  },
  { path: '**', redirectTo: '' },
];
