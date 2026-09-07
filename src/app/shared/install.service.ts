import { Injectable, signal } from '@angular/core';
interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
@Injectable({ providedIn: 'root' })
export class InstallService {
  readonly prompt = signal<InstallPrompt | null>(null);
  constructor() {
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      this.prompt.set(event as InstallPrompt);
    });
    window.addEventListener('appinstalled', () => this.prompt.set(null));
  }
  async install() {
    const prompt = this.prompt();
    if (prompt) {
      await prompt.prompt();
      await prompt.userChoice;
      this.prompt.set(null);
    }
  }
}
