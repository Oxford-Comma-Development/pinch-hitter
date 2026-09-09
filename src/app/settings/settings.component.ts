import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalDirective } from '../shared/modal.directive';
import { InstallService } from '../shared/install.service';
import { CoachStore } from '../data/coach-store';
import { ImportPreview, Team } from '../data/models';
import { eventsCsv, backupJson } from '../data/transfer';
import { downloadFile, shareFile } from '../shared/files';
@Component({
  selector: 'app-settings',
  imports: [FormsModule, ModalDirective],
  template: `
    <div class="page">
      <p class="eyebrow">YOUR NOTEBOOK, YOUR WAY</p>
      <h1>Settings.</h1>
      <p class="muted">Ready for your team. Owned by you.</p>
      @if (message()) {
        <p class="notice" role="status">{{ message() }}</p>
      }
      <div class="settings-grid">
        <section class="card">
          <p class="eyebrow">THE DUGOUT</p>
          <h2>Team</h2>
          @if (store.teams().length) {
            <label
              >Active team<select
                aria-label="Active team"
                [ngModel]="store.settings().activeTeamId"
                (ngModelChange)="switchTeam($event)"
              >
                @for (team of store.teams(); track team.id) {
                  <option [value]="team.id">{{ team.name }} · {{ team.season }}</option>
                }
              </select></label
            >
            <p class="muted small">Each team keeps its own roster, practices, and history.</p>
          }
          <div class="row">
            @if (store.activeTeam()) {
              <button (click)="editTeam(store.activeTeam()!)">Edit team</button>
            }
            <button (click)="editTeam()">+ Add team</button>
          </div>
        </section>
        <section class="card">
          <p class="eyebrow">NEXT TIME AT THE FIELD</p>
          <h2>Practice defaults</h2>
          <div class="form-grid">
            <label
              >Pitcher handedness<select
                aria-label="Pitcher handedness"
                [ngModel]="store.settings().defaultPitcherHand"
                (ngModelChange)="store.updateSettings({ defaultPitcherHand: $event })"
              >
                <option value="R">RHP</option>
                <option value="L">LHP</option>
              </select></label
            ><label
              >Rotation<select
                aria-label="Rotation"
                [ngModel]="rotationChoice()"
                (ngModelChange)="changeRotation($event)"
              >
                <option value="manual">Manual Advance</option>
                <option value="1">After 1 recorded contact</option>
                <option value="3">After 3 recorded contacts</option>
                <option value="5">After 5 recorded contacts</option>
                <option value="custom">Custom count</option>
              </select></label
            >
            @if (rotationChoice() === 'custom') {
              <label
                >Recorded contacts per turn<input
                  type="number"
                  min="1"
                  max="100"
                  [ngModel]="store.settings().rotationCount"
                  (change)="customRotation($event)"
              /></label>
            }
          </div>
          <label class="check-label"
            ><input
              type="checkbox"
              [ngModel]="store.settings().haptics"
              (ngModelChange)="store.updateSettings({ haptics: $event })"
            />Gentle vibration after a contact, when supported</label
          >
          <p class="muted small">
            Defaults apply to new practices. You can change them during a session.
          </p>
        </section>
        <section class="card data-card">
          <p class="eyebrow">TAKE YOUR NOTEBOOK WITH YOU</p>
          <h2>Backup & export</h2>
          <p class="muted">
            Save a complete JSON backup to restore on another device. Use CSV for spreadsheets and
            baseball analysis.
          </p>
          <div class="data-counts">
            <span
              ><strong>{{ store.teams().length }}</strong> teams</span
            ><span
              ><strong>{{ store.players().length }}</strong> players</span
            ><span
              ><strong>{{ store.sessions().length }}</strong> practices</span
            ><span
              ><strong>{{ store.events().length }}</strong> contacts</span
            >
          </div>
          <div class="row">
            <button class="primary" (click)="exportJson()">Download JSON backup</button
            ><button (click)="shareBackup()">Share backup</button>
          </div>
          <div class="csv-row">
            <label
              >CSV scope<select aria-label="CSV scope" [(ngModel)]="csvScope">
                <option value="team">Active team / season</option>
                <option value="all">All local data</option>
              </select></label
            ><button (click)="exportCsv()">Export contacts CSV</button>
          </div>
          <p class="muted small">For a player, session, or filtered CSV, export from Reports.</p>
        </section>
        <section class="card">
          <p class="eyebrow">BRING YOUR DATA HOME</p>
          <h2>Import a backup</h2>
          <p class="muted">
            Choose a Pinch Hitter JSON file. Review its contents before merging it into this
            notebook.
          </p>
          <label
            >JSON backup<input
              type="file"
              accept=".json,application/json"
              (change)="readBackup($event)"
          /></label>
          @if (importError()) {
            <p role="alert" class="error">{{ importError() }}</p>
          }
          @if (preview()) {
            <div class="import-box">
              <h3>Ready to merge</h3>
              <p>
                {{ preview()!.counts.teams }} teams · {{ preview()!.counts.players }} players ·
                {{ preview()!.counts.sessions }} practices · {{ preview()!.counts.events }} contacts
                · {{ preview()!.counts.notes }} notes
              </p>
              <p class="small muted">
                {{ preview()!.conflicts }} existing records share an ID. The newer version of each
                record wins. Other local records stay in your notebook.
              </p>
              @for (warning of preview()!.warnings; track warning) {
                <p class="small">{{ warning }}</p>
              }
              <div class="row">
                <button class="primary" [disabled]="busy()" (click)="applyImport()">
                  Merge backup</button
                ><button (click)="preview.set(null)">Cancel</button>
              </div>
            </div>
          }
        </section>
        <section class="card">
          <p class="eyebrow">BUILT FOR THE BALLPARK</p>
          <h2>On this device</h2>
          <p class="muted">
            Once loaded, your roster, practice capture, reports, and exports work offline. Speech
            recognition may require a connection.
          </p>
          @if (installPrompt()) {
            <button class="primary" (click)="install()">Install Pinch Hitter</button>
          } @else {
            <p class="small">
              To install: use your browser’s <strong>Install app</strong> menu, or on iPhone use
              <strong>Share → Add to Home Screen</strong>.
            </p>
          }
          <button (click)="protectStorage()">Keep data on this device</button>
          <p class="small muted">
            {{
              storageStatus() ||
                'Ask the browser to protect your local storage. Keep a separate backup in case your device is lost or browser data is cleared.'
            }}
          </p>
          <p class="small muted">
            Pinch Hitter · Version 1.0.0<br />No account. No analytics. No coach data sent to a
            server.
          </p>
        </section>
        <section class="card danger-card">
          <h2>Clear this notebook</h2>
          <p class="muted">
            Permanently remove all teams, players, practices, contacts, and notes from this browser.
            Download a backup first.
          </p>
          <label
            >Type DELETE to confirm<input
              [(ngModel)]="deleteText"
              autocomplete="off"
              placeholder="DELETE" /></label
          ><button
            class="danger"
            [disabled]="deleteText !== 'DELETE' || busy()"
            (click)="clearData()"
          >
            Delete all local data
          </button>
        </section>
      </div>
    </div>
    @if (teamEditor()) {
      <div class="sheet-backdrop">
        <section
          appModal
          class="sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="team-title"
          (keydown.escape)="teamEditor.set(false)"
        >
          <div class="sheet-header">
            <h2 id="team-title">{{ teamId ? 'Edit team' : 'Add team' }}</h2>
            <button (click)="teamEditor.set(false)" aria-label="Close team editor">✕</button>
          </div>
          <form class="stack" (ngSubmit)="saveTeam()">
            <label
              >Team name<input
                name="teamName"
                [(ngModel)]="teamDraft.name"
                required
                maxlength="100"
            /></label>
            <div class="form-grid">
              <label
                >Short name<input
                  name="shortName"
                  [(ngModel)]="teamDraft.shortName"
                  maxlength="20" /></label
              ><label
                >Season<input name="season" [(ngModel)]="teamDraft.season" maxlength="40"
              /></label>
            </div>
            <label
              >Team notes<textarea
                name="notes"
                [(ngModel)]="teamDraft.notes"
                maxlength="10000"
              ></textarea>
            </label>
            <div class="row">
              <button class="primary" [disabled]="!teamDraft.name.trim() || busy()">
                Save team</button
              ><button type="button" (click)="teamEditor.set(false)">Cancel</button>
            </div>
          </form>
        </section>
      </div>
    }
  `,
  styles: `
    .settings-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 22px;
    }
    .card h2 {
      margin-bottom: 18px;
    }
    .card .check-label {
      margin-top: 16px;
      font-size: 12px;
    }
    .card .row {
      margin-top: 16px;
    }
    .data-card {
      background: #ecefdf;
    }
    .data-counts {
      display: flex;
      gap: 18px;
      flex-wrap: wrap;
      margin: 24px 0;
      font-size: 11px;
    }
    .data-counts strong {
      display: block;
      font-size: 26px;
      color: var(--green);
    }
    .csv-row {
      display: flex;
      gap: 12px;
      align-items: end;
      margin-top: 22px;
    }
    .csv-row label {
      flex: 1;
    }
    .csv-row button {
      flex-shrink: 0;
    }
    .import-box {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid var(--line);
    }
    .danger-card {
      border-color: #dcc4b8;
    }
    .danger-card button {
      margin-top: 16px;
    }
    @media (max-width: 760px) {
      .settings-grid {
        grid-template-columns: 1fr;
      }
      .csv-row {
        flex-wrap: wrap;
      }
      .csv-row label {
        min-width: 170px;
      }
    }
  `,
})
export class SettingsComponent {
  readonly store = inject(CoachStore);
  readonly message = signal('');
  readonly importError = signal('');
  readonly preview = signal<ImportPreview | null>(null);
  readonly busy = signal(false);
  readonly teamEditor = signal(false);
  readonly installer = inject(InstallService);
  readonly installPrompt = this.installer.prompt;
  readonly storageStatus = signal('');
  csvScope = 'team';
  deleteText = '';
  teamId = '';
  teamDraft = { name: '', shortName: '', season: String(new Date().getFullYear()), notes: '' };
  custom = false;

  rotationChoice() {
    const n = this.store.settings().rotationCount;
    return this.custom
      ? 'custom'
      : n === null
        ? 'manual'
        : [1, 3, 5].includes(n)
          ? String(n)
          : 'custom';
  }
  async changeRotation(value: string) {
    this.custom = value === 'custom';
    await this.store.updateSettings({
      rotationCount: value === 'manual' ? null : value === 'custom' ? 8 : Number(value),
    });
  }
  async customRotation(event: Event) {
    const n = Number((event.target as HTMLInputElement).value);
    if (Number.isInteger(n) && n >= 1 && n <= 100)
      await this.store.updateSettings({ rotationCount: n });
  }
  async switchTeam(id: string) {
    await this.store.setActiveTeam(id);
    this.message.set('Active team changed. Your other teams and practices are saved.');
  }
  editTeam(team?: Team) {
    this.teamId = team?.id || '';
    this.teamDraft = team
      ? { name: team.name, shortName: team.shortName, season: team.season, notes: team.notes }
      : { name: '', shortName: '', season: String(new Date().getFullYear()), notes: '' };
    this.teamEditor.set(true);
  }
  async saveTeam() {
    if (!this.teamDraft.name.trim() || this.busy()) return;
    this.busy.set(true);
    try {
      const input = { ...this.teamDraft, name: this.teamDraft.name.trim() };
      if (this.teamId) await this.store.updateTeam(this.teamId, input);
      else await this.store.addTeam(input);
      this.teamEditor.set(false);
      this.message.set('Team saved.');
    } finally {
      this.busy.set(false);
    }
  }
  async exportJson() {
    const backup = await this.store.exportFreshBackup();
    downloadFile(backupJson(backup), this.backupName(), 'application/json');
    this.message.set('JSON backup downloaded. Save it somewhere you can find on another device.');
  }
  backupName() {
    return 'pinch-hitter-' + new Date().toISOString().slice(0, 10) + '.json';
  }
  async shareBackup() {
    const backup = await this.store.exportFreshBackup();
    this.message.set(await shareFile(backupJson(backup), this.backupName(), 'application/json'));
  }
  async exportCsv() {
    const backup = await this.store.exportFreshBackup();
    const events = backup.events.filter(
      (e) => this.csvScope === 'all' || e.teamId === backup.settings.activeTeamId,
    );
    downloadFile(
      eventsCsv(events, backup.teams, backup.sessions, backup.notes),
      'baseball-contacts.csv',
      'text/csv;charset=utf-8',
    );
    this.message.set(events.length + ' contacts exported to CSV.');
  }
  async readBackup(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.preview.set(null);
    this.importError.set('');
    try {
      if (file) {
        if (file.size > 50_000_000) throw new Error('Please choose a backup smaller than 50 MB.');
        this.preview.set(this.store.previewImport(await file.text()));
      }
    } catch (error) {
      this.importError.set(error instanceof Error ? error.message : 'This file could not be read.');
    }
    input.value = '';
  }
  async applyImport() {
    const preview = this.preview();
    if (!preview || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.importBackup(preview);
      this.preview.set(null);
      this.message.set('Backup merged. Your notebook is ready.');
    } catch (error) {
      this.importError.set(
        error instanceof Error ? error.message : 'Import failed. Existing data was preserved.',
      );
    } finally {
      this.busy.set(false);
    }
  }
  async clearData() {
    if (
      this.deleteText !== 'DELETE' ||
      !window.confirm(
        'Delete all Pinch Hitter data on this device? This cannot be undone without a backup.',
      )
    )
      return;
    this.busy.set(true);
    try {
      await this.store.clearAll();
      this.deleteText = '';
      this.message.set('This local notebook has been cleared.');
    } finally {
      this.busy.set(false);
    }
  }
  async protectStorage() {
    const kept = await navigator.storage?.persist?.();
    this.storageStatus.set(
      kept
        ? 'Persistent storage is enabled. Keep exporting backups for device loss.'
        : 'Your browser manages storage automatically. Regular backups protect your notebook.',
    );
  }
  async install() {
    await this.installer.install();
  }
}
