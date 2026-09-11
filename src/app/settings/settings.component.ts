import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ModalDirective } from '../shared/modal.directive';
import { InstallService } from '../shared/install.service';
import { CoachStore } from '../data/coach-store';
import { EntitlementService, CoachTier } from '../data/entitlement.service';
import { ImportPreview, Team } from '../data/models';
import { eventsCsv, backupJson } from '../data/transfer';
import { RouterLink } from '@angular/router';
import { backupFileName, canShareFiles, downloadFile, shareFile } from '../shared/files';
@Component({
  selector: 'app-settings',
  imports: [FormsModule, ModalDirective, DatePipe, RouterLink],
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
          <label
            class="check-label"
            style="margin-top: 14px; display: flex; align-items: center; gap: 8px;"
          >
            <input
              type="checkbox"
              [ngModel]="store.settings().leftHandedMode"
              (ngModelChange)="store.updateSettings({ leftHandedMode: $event })"
            />
            Left-handed dugout mode (mirrors primary controls for left-thumb reach)
          </label>
          <p class="muted small">
            Defaults apply to new practices. You can change them during a session.
          </p>
        </section>
        <section class="card visual-card">
          <p class="eyebrow">VISUAL ACCESSIBILITY &amp; DISPLAY</p>
          <h2>Field surface &amp; color palette</h2>
          <p class="muted small">
            Customize spray chart contrast and marker colors for barrier-free vision and outdoor
            sunlight.
          </p>

          <fieldset class="setting-group" style="margin-top: 16px; border: 0; padding: 0;">
            <legend class="eyebrow" style="margin-bottom: 8px;">COLOR PALETTE</legend>
            <div class="visual-options" role="radiogroup" aria-label="Spray chart color palette">
              <label
                class="visual-option"
                [class.selected]="(store.settings().colorPalette || 'standard') === 'standard'"
              >
                <input
                  type="radio"
                  name="colorPalette"
                  value="standard"
                  [checked]="(store.settings().colorPalette || 'standard') === 'standard'"
                  (change)="store.updateSettings({ colorPalette: 'standard' })"
                />
                <div>
                  <strong>Standard Classic</strong>
                  <p class="small muted">Pastel palette: soft coral, amber, and violet tones.</p>
                </div>
              </label>

              <label
                class="visual-option"
                [class.selected]="store.settings().colorPalette === 'colorblind'"
              >
                <input
                  type="radio"
                  name="colorPalette"
                  value="colorblind"
                  [checked]="store.settings().colorPalette === 'colorblind'"
                  (change)="
                    store.updateSettings({ colorPalette: 'colorblind', shapeMarkers: true })
                  "
                />
                <div>
                  <strong>Color-Blind Friendly (Okabe-Ito)</strong>
                  <p class="small muted">
                    Barrier-free spectrum for red-green CVD (deuteranopia, protanopia) with
                    blue-yellow heatmaps.
                  </p>
                </div>
              </label>

              <label
                class="visual-option"
                [class.selected]="store.settings().colorPalette === 'high_contrast'"
              >
                <input
                  type="radio"
                  name="colorPalette"
                  value="high_contrast"
                  [checked]="store.settings().colorPalette === 'high_contrast'"
                  (change)="
                    store.updateSettings({ colorPalette: 'high_contrast', shapeMarkers: true })
                  "
                />
                <div>
                  <strong>High Contrast</strong>
                  <p class="small muted">
                    Maximized luminance contrast: electric yellow, cyan, and neon accents.
                  </p>
                </div>
              </label>
            </div>
          </fieldset>

          <fieldset class="setting-group" style="margin-top: 18px; border: 0; padding: 0;">
            <legend class="eyebrow" style="margin-bottom: 8px;">FIELD SURFACE</legend>
            <div class="visual-options" role="radiogroup" aria-label="Field background surface">
              <label
                class="visual-option"
                [class.selected]="(store.settings().fieldTheme || 'classic') === 'classic'"
              >
                <input
                  type="radio"
                  name="fieldTheme"
                  value="classic"
                  [checked]="(store.settings().fieldTheme || 'classic') === 'classic'"
                  (change)="store.updateSettings({ fieldTheme: 'classic' })"
                />
                <div>
                  <strong>Classic Ballpark Green</strong>
                  <p class="small muted">Traditional grass field with dirt infield diamond.</p>
                </div>
              </label>

              <label
                class="visual-option"
                [class.selected]="store.settings().fieldTheme === 'high_contrast'"
              >
                <input
                  type="radio"
                  name="fieldTheme"
                  value="high_contrast"
                  [checked]="store.settings().fieldTheme === 'high_contrast'"
                  (change)="store.updateSettings({ fieldTheme: 'high_contrast' })"
                />
                <div>
                  <strong>High-Contrast Slate (Direct Sunlight)</strong>
                  <p class="small muted">
                    Deep slate field with bold white chalk baselines and high-visibility bases to
                    cut outdoor glare.
                  </p>
                </div>
              </label>
            </div>
          </fieldset>

          <div style="margin-top: 18px;">
            <label class="check-label" style="display: flex; align-items: center; gap: 8px;">
              <input
                type="checkbox"
                [ngModel]="store.settings().shapeMarkers"
                (ngModelChange)="store.updateSettings({ shapeMarkers: $event })"
              />
              Multi-shape marker glyphs (circles, diamonds, triangles, crosses, and stars)
            </label>
            <p class="small muted" style="margin-top: 4px; margin-left: 28px;">
              Ensures contact classifications and results are distinguishable without relying on
              color alone (WCAG 1.4.1).
            </p>
          </div>
        </section>
        <section class="card license-card">
          <p class="eyebrow">COACH LICENSE</p>
          <div class="license-heading">
            <h2>Pro features &amp; license</h2>
            <span class="badge" [class.badge-pro]="entitlement.isPro()">
              {{ entitlement.isPro() ? 'PRO COACH' : 'FREE COACH' }}
            </span>
          </div>
          <p class="muted small">
            Test and preview Pinch Hitter features. Choose between full Pro access or simulated Free
            Coach tier.
          </p>

          <div class="license-simulator" role="radiogroup" aria-label="Simulated license tier">
            <label class="simulator-option" [class.selected]="entitlement.tier() === 'pro'">
              <input
                type="radio"
                name="simulatedTier"
                value="pro"
                [checked]="entitlement.tier() === 'pro'"
                (change)="setTier('pro')"
              />
              <div>
                <strong>Pro Coach (Unlocked)</strong>
                <p class="small muted">
                  All features unlocked: custom fences, multi-team, deep analytics.
                </p>
              </div>
            </label>

            <label class="simulator-option" [class.selected]="entitlement.tier() === 'free'">
              <input
                type="radio"
                name="simulatedTier"
                value="free"
                [checked]="entitlement.tier() === 'free'"
                (change)="setTier('free')"
              />
              <div>
                <strong>Free Coach (Preview)</strong>
                <p class="small muted">
                  Core features only; preview how gating and pro badges appear.
                </p>
              </div>
            </label>
          </div>

          <div class="license-features-summary">
            <span class="small eyebrow">CAPABILITIES:</span>
            <ul class="feature-bullets">
              <li>Live BP capture, whiff scale &amp; undo: <strong>Always Free</strong></li>
              <li>JSON backups &amp; CSV export: <strong>Always Free</strong></li>
              <li>
                Multi-team management:
                <strong>{{ entitlement.canAccess('multi_team') ? 'Unlocked' : 'Pro Only' }}</strong>
              </li>
              <li>
                Custom outfield fences:
                <strong>{{
                  entitlement.canAccess('custom_field_dimensions') ? 'Unlocked' : 'Pro Only'
                }}</strong>
              </li>
              <li>
                Multi-hitter comparisons:
                <strong>{{
                  entitlement.canAccess('multi_player_comparison') ? 'Unlocked' : 'Pro Only'
                }}</strong>
              </li>
              <li>
                Rolling trend curves:
                <strong>{{
                  entitlement.canAccess('advanced_time_series') ? 'Unlocked' : 'Pro Only'
                }}</strong>
              </li>
            </ul>
          </div>

          <p class="small muted license-note">
            Method-agnostic entitlement active. Payment integrations (Stripe / offline keys) plug
            into this engine.
          </p>
        </section>
        <section class="card data-card">
          <p class="eyebrow">TAKE YOUR NOTEBOOK WITH YOU</p>
          <h2>Take your notebook with you</h2>
          <p class="philosophy-quote">
            “Pinch Hitter doesn't keep your data on our servers. Your notebook stays on your devices
            and in whatever storage provider you trust.”
          </p>
          <p class="platform-statement muted small">
            Works on iPhone, iPad, Android, Windows, Mac, and Chromebook. No app store required.
          </p>

          <div
            class="backup-status-pill"
            [class.unbacked]="store.unbackedWork().hasSubstantialWork"
          >
            @if (store.unbackedWork().hasSubstantialWork) {
              <span class="status-indicator warning" aria-hidden="true">●</span>
              <div>
                <strong>Backup recommended:</strong> {{ store.unbackedWork().summary }}.
                <p class="small muted">Save a copy to iCloud Drive, Google Drive, or your files.</p>
              </div>
            } @else if (store.lastBackupAt()) {
              <span class="status-indicator up-to-date" aria-hidden="true">✓</span>
              <div>
                <strong>Notebook backed up.</strong>
                <p class="small muted">
                  Last saved on this device: {{ store.lastBackupAt() | date: 'medium' }}
                </p>
              </div>
            } @else {
              <span class="status-indicator" aria-hidden="true">○</span>
              <div>
                <strong>Not yet backed up on this device.</strong>
                <p class="small muted">Save a copy to keep your team and practices safe.</p>
              </div>
            }
          </div>

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
            @if (canShare()) {
              <button class="primary" (click)="shareBackup()">Save or share notebook</button>
              <button (click)="exportJson()">Download JSON backup</button>
            } @else {
              <button class="primary" (click)="exportJson()">Download JSON backup</button>
              <button (click)="shareBackup()">Save or share notebook</button>
            }
          </div>
          <p class="muted small share-hint">
            @if (canShare()) {
              Opens your device share sheet. On iPhone/iPad, choose
              <strong>Save to Files / iCloud Drive</strong> or AirDrop. On Android, choose
              <strong>Save to Drive</strong> or Quick Share.
            } @else {
              Save a complete JSON backup to restore on another device.
            }
          </p>
          <div class="csv-row">
            <label
              >CSV scope<select aria-label="CSV scope" [(ngModel)]="csvScope">
                <option value="team">Active team / season</option>
                <option value="all">All local data</option>
              </select></label
            ><button (click)="exportCsv()">Export contacts CSV</button>
          </div>
          <p class="muted small">
            For spreadsheets and baseball analysis. For a player or session CSV, export from
            Reports.
          </p>
        </section>
        <section class="card">
          <p class="eyebrow">BRING YOUR NOTEBOOK HOME</p>
          <h2>Open notebook on this device</h2>
          <p class="muted">
            Opening on another phone, iPad, or laptop? Select your Pinch Hitter JSON file from
            iCloud Drive, Google Drive, or Files. Review its contents before merging.
          </p>
          <label
            >JSON backup<input
              type="file"
              accept=".json,application/json"
              (change)="readBackup($event)"
          /></label>
          <p class="small muted">
            Tip: On iPhone/iPad, choose your file from iCloud Drive or Files. On Android, choose
            from Google Drive or Downloads.
          </p>
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
          <p class="small cross-platform-note">
            Works on iPhone, iPad, Android, Windows, Mac, and Chromebook. No app store required.
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
          <p class="small">
            <a routerLink="/privacy">Read our Privacy Policy →</a>
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
            <div class="logo-upload-group">
              <span>Team logo <span class="muted small">(optional)</span></span>
              @if (teamDraft.logoUrl) {
                <div class="logo-preview-row">
                  <img [src]="teamDraft.logoUrl" alt="Team logo preview" class="logo-thumb" />
                  <button type="button" class="text-button" (click)="removeLogo()">
                    Remove logo
                  </button>
                </div>
              } @else {
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    (change)="onLogoSelected($event)"
                    aria-label="Upload team logo"
                  />
                </label>
                <span class="small muted">Square or crest image recommended (PNG, JPG, SVG).</span>
              }
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
    .license-card {
      border-color: #c9d8c5;
      background: #fbfcf8;
    }
    .license-heading {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }
    .license-heading h2 {
      margin-bottom: 0;
    }
    .badge-pro {
      background: var(--green);
      color: #fff8de;
      letter-spacing: 0.5px;
    }
    .license-simulator,
    .visual-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 14px 0;
    }
    .simulator-option,
    .visual-option {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--surface);
      cursor: pointer;
      transition:
        border-color 0.15s ease,
        background 0.15s ease;
    }
    .simulator-option.selected,
    .visual-option.selected {
      border-color: var(--green);
      background: #f4f7ee;
    }
    .simulator-option input[type='radio'],
    .visual-option input[type='radio'] {
      margin-top: 3px;
      accent-color: var(--green);
    }
    .simulator-option strong,
    .visual-option strong {
      display: block;
      font-size: 14px;
      color: var(--ink);
    }
    .simulator-option p,
    .visual-option p {
      margin: 2px 0 0;
      line-height: 1.35;
    }
    .license-features-summary {
      background: var(--cream);
      border-radius: 8px;
      padding: 12px 14px;
      margin-top: 14px;
    }
    .feature-bullets {
      margin: 8px 0 0;
      padding-left: 18px;
      font-size: 12px;
      line-height: 1.5;
    }
    .feature-bullets li {
      margin-bottom: 3px;
    }
    .license-note {
      margin-top: 12px;
      line-height: 1.35;
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
    .philosophy-quote {
      font-style: italic;
      color: var(--ink);
      background: #e4e8d4;
      padding: 12px 14px;
      border-left: 3px solid var(--green);
      border-radius: 0 8px 8px 0;
      margin: 14px 0 10px;
      line-height: 1.4;
      font-size: 13px;
    }
    .platform-statement {
      margin-bottom: 16px;
      font-weight: 500;
    }
    .backup-status-pill {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      background: #f4f6ec;
      border: 1px solid #d2d8bf;
      border-radius: 10px;
      padding: 12px 14px;
      margin: 16px 0;
      font-size: 13px;
    }
    .backup-status-pill.unbacked {
      background: #fef7ea;
      border-color: #ebd2a4;
    }
    .status-indicator {
      font-weight: 900;
      font-size: 14px;
      line-height: 1.3;
    }
    .status-indicator.warning {
      color: #b8621b;
    }
    .status-indicator.up-to-date {
      color: var(--green);
    }
    .backup-status-pill p {
      margin: 3px 0 0;
    }
    .share-hint {
      margin-top: 10px;
      line-height: 1.35;
    }
    .cross-platform-note {
      font-weight: 600;
      color: var(--green);
      margin: 12px 0;
    }
    .logo-upload-group {
      margin-top: 6px;
    }
    .logo-preview-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 6px;
    }
    .logo-thumb {
      width: 52px;
      height: 52px;
      object-fit: contain;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #fff;
      padding: 4px;
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
  readonly entitlement = inject(EntitlementService);
  readonly message = signal('');
  readonly importError = signal('');
  readonly preview = signal<ImportPreview | null>(null);
  readonly busy = signal(false);
  readonly teamEditor = signal(false);
  readonly installer = inject(InstallService);
  readonly installPrompt = this.installer.prompt;
  readonly storageStatus = signal('');
  readonly canShare = signal(canShareFiles());
  csvScope = 'team';
  deleteText = '';
  teamId = '';
  teamDraft: {
    name: string;
    shortName: string;
    season: string;
    notes: string;
    logoUrl?: string;
  } = { name: '', shortName: '', season: String(new Date().getFullYear()), notes: '', logoUrl: '' };
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
  setTier(tier: CoachTier) {
    this.entitlement.setSimulatedTier(tier);
    this.message.set(
      tier === 'pro'
        ? 'License switched to Pro Coach (all features unlocked).'
        : 'License switched to Free Coach (gated preview mode).',
    );
  }
  editTeam(team?: Team) {
    this.teamId = team?.id || '';
    this.teamDraft = team
      ? {
          name: team.name,
          shortName: team.shortName,
          season: team.season,
          notes: team.notes,
          logoUrl: team.logoUrl || '',
        }
      : {
          name: '',
          shortName: '',
          season: String(new Date().getFullYear()),
          notes: '',
          logoUrl: '',
        };
    this.teamEditor.set(true);
  }
  onLogoSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      this.message.set('Please choose an image file (PNG, JPEG, WebP, SVG).');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 256;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          this.teamDraft.logoUrl = canvas.toDataURL('image/png');
        } else {
          this.teamDraft.logoUrl = reader.result as string;
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }
  removeLogo() {
    this.teamDraft.logoUrl = '';
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
    this.store.recordBackupExported();
    this.message.set('JSON backup downloaded. Save it somewhere you can find on another device.');
  }
  backupName() {
    return backupFileName();
  }
  async shareBackup() {
    const backup = await this.store.exportFreshBackup();
    const result = await shareFile(backupJson(backup), this.backupName(), 'application/json');
    if (!result.includes('canceled')) {
      this.store.recordBackupExported();
    }
    this.message.set(result);
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
