import { Injectable, signal } from '@angular/core';
import { FeatureId } from '../data/entitlement.service';

/**
 * Opens the single app-wide upgrade sheet. Never call this from live practice capture:
 * upsells belong in reports, exports, and team management only.
 */
@Injectable({ providedIn: 'root' })
export class ProUpsellService {
  private readonly _request = signal<{ feature: FeatureId | null } | null>(null);
  readonly request = this._request.asReadonly();

  open(feature: FeatureId | null = null): void {
    this._request.set({ feature });
  }

  close(): void {
    this._request.set(null);
  }
}
