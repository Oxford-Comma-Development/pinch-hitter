import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { InstallService } from './shared/install.service';
import { CoachStore } from './data/coach-store';
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly store = inject(CoachStore);
  readonly installer = inject(InstallService);
  private readonly router = inject(Router);
  private readonly updates = inject(SwUpdate, { optional: true });
  readonly url = signal(this.router.url);
  readonly inPractice = computed(
    () => this.url().split('?')[0] === '/practice' && !!this.store.activeSession(),
  );
  readonly online = signal(navigator.onLine);
  readonly updateReady = signal(false);
  constructor() {
    void this.store.init().catch(() => undefined);
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) this.url.set(event.urlAfterRedirects);
    });
    window.addEventListener('online', () => this.online.set(true));
    window.addEventListener('offline', () => this.online.set(false));
    this.updates?.versionUpdates.subscribe((event) => {
      if (event.type === 'VERSION_READY') this.updateReady.set(true);
    });
  }
  applyUpdate() {
    window.location.reload();
  }
}
