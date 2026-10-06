import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EntitlementService } from '../data/entitlement.service';
import { TranslatePipe } from '../i18n/translate.pipe';

let nextFormId = 0;

/** Paste-anything unlock: accepts the bare code, the activation link, or a whole email. */
@Component({
  selector: 'app-unlock-code-form',
  imports: [FormsModule, TranslatePipe],
  template: `
    <form class="unlock-form" (ngSubmit)="submit()">
      <label [for]="inputId">{{ 'pro.code.label' | t }}</label>
      <textarea
        [id]="inputId"
        name="unlockCode"
        rows="3"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        [placeholder]="'pro.code.placeholder' | t"
        [(ngModel)]="input"
        (ngModelChange)="error.set('')"
        [attr.aria-describedby]="error() ? errorId : null"
        [attr.aria-invalid]="error() ? true : null"
      ></textarea>
      @if (error()) {
        <p [id]="errorId" class="error small" role="alert">{{ error() | t }}</p>
      }
      <button type="submit" class="primary" [disabled]="busy() || !input.trim()">
        {{ (busy() ? 'pro.code.checking' : 'pro.code.activate') | t }}
      </button>
    </form>
  `,
  styles: `
    .unlock-form {
      display: grid;
      gap: 8px;
    }
    label {
      font-weight: 700;
    }
    textarea {
      width: 100%;
      min-height: 76px;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 9px;
      background: var(--surface);
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 13px;
      word-break: break-all;
      resize: vertical;
    }
    .error {
      margin: 0;
    }
  `,
})
export class UnlockCodeFormComponent {
  readonly inputId = `unlock-code-${++nextFormId}`;
  readonly errorId = `${this.inputId}-error`;
  private readonly entitlement = inject(EntitlementService);
  readonly activated = output<void>();
  readonly busy = signal(false);
  readonly error = signal('');
  input = '';

  async submit() {
    if (this.busy() || !this.input.trim()) return;
    this.busy.set(true);
    try {
      const result = await this.entitlement.activate(this.input);
      if (result.ok) {
        this.input = '';
        this.activated.emit();
      } else {
        this.error.set(`pro.code.error.${result.reason}`);
      }
    } catch {
      this.error.set('pro.code.error.storage');
    } finally {
      this.busy.set(false);
    }
  }
}
