import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalDirective } from '../shared/modal.directive';
import { InstallService } from '../shared/install.service';
import { CoachStore } from '../data/coach-store';
import { EntitlementService } from '../data/entitlement.service';
import { ProLicenseCardComponent } from '../pro/pro-license-card.component';
import { ProUpsellService } from '../pro/pro-upsell.service';
import {
  FieldPresetKey,
  ImportPreview,
  OutfieldFenceConfig,
  STANDARD_FENCE_PRESETS,
  Team,
} from '../data/models';
import { eventsCsv, backupJson } from '../data/transfer';
import { RouterLink } from '@angular/router';
import { backupFileName, canShareFiles, downloadFile, shareFile } from '../shared/files';
import { TranslatePipe } from '../i18n/translate.pipe';
import { LocalDatePipe } from '../i18n/local-date.pipe';
import { I18nService } from '../i18n/i18n.service';
@Component({
  selector: 'app-settings',
  imports: [
    FormsModule,
    ModalDirective,
    LocalDatePipe,
    RouterLink,
    TranslatePipe,
    ProLicenseCardComponent,
  ],
  template: `
    <div class="page">
      <p class="eyebrow">{{ 'settings.eyebrow' | t }}</p>
      <h1>{{ 'settings.title' | t }}.</h1>
      <p class="muted">{{ 'settings.subtitle' | t }}</p>
      @if (message()) {
        <p class="notice" role="status">{{ message() }}</p>
      }
      <div class="settings-grid">
        <section class="card language-card">
          <p class="eyebrow">IDIOMA / REGIONAL</p>
          <h2>{{ 'settings.language' | t }}</h2>
          <label
            >{{ 'settings.language' | t
            }}<select
              aria-label="Language / Idioma"
              [ngModel]="store.settings().language || 'en'"
              (ngModelChange)="store.updateSettings({ language: $event })"
            >
              <option value="en">{{ 'settings.langEn' | t }}</option>
              <option value="es">{{ 'settings.langEs' | t }}</option>
            </select></label
          >
          <p class="muted small">{{ 'settings.languageDesc' | t }}</p>
        </section>
        <section class="card">
          <p class="eyebrow">{{ 'settings.dugoutEyebrow' | t }}</p>
          <h2>{{ 'settings.teamSection' | t }}</h2>
          @if (store.teams().length) {
            <label
              >{{ 'settings.activeTeam' | t
              }}<select
                [attr.aria-label]="'settings.activeTeam' | t"
                [ngModel]="store.settings().activeTeamId"
                (ngModelChange)="switchTeam($event)"
              >
                @for (team of store.teams(); track team.id) {
                  <option [value]="team.id">{{ team.name }} · {{ team.season }}</option>
                }
              </select></label
            >
            <p class="muted small">{{ 'settings.teamHelp' | t }}</p>
          }
          <div class="row">
            @if (store.activeTeam()) {
              <button (click)="editTeam(store.activeTeam()!)">{{ 'settings.editTeam' | t }}</button>
            }
            <button (click)="addTeam()">
              {{ 'settings.addTeam' | t }}
              @if (!entitlement.canAccess('multi_team')) {
                <span class="pro-tag">✦ PRO</span>
              }
            </button>
          </div>
        </section>
        <section class="card">
          <p class="eyebrow">{{ 'settings.nextTimeEyebrow' | t }}</p>
          <h2>{{ 'settings.practiceDefaults' | t }}</h2>
          <div class="form-grid">
            <label
              >{{ 'settings.pitcherHand' | t
              }}<select
                [attr.aria-label]="'settings.pitcherHand' | t"
                [ngModel]="store.settings().defaultPitcherHand"
                (ngModelChange)="store.updateSettings({ defaultPitcherHand: $event })"
              >
                <option value="R">{{ 'baseball.rhp' | t }}</option>
                <option value="L">{{ 'baseball.lhp' | t }}</option>
              </select></label
            ><label
              >{{ 'settings.rotation' | t
              }}<select
                [attr.aria-label]="'settings.rotation' | t"
                [ngModel]="rotationChoice()"
                (ngModelChange)="changeRotation($event)"
              >
                <option value="manual">{{ 'settings.rotationManual' | t }}</option>
                <option value="1">{{ 'settings.rotation1' | t }}</option>
                <option value="3">{{ 'settings.rotation3' | t }}</option>
                <option value="5">{{ 'settings.rotation5' | t }}</option>
                <option value="custom">{{ 'settings.rotationCustom' | t }}</option>
              </select></label
            >
            @if (rotationChoice() === 'custom') {
              <label
                >{{ 'settings.contactsPerTurn' | t
                }}<input
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
            {{ 'settings.leftHandedMode' | t }}
          </label>
          <p class="muted small">
            {{ 'settings.defaultsNote' | t }}
          </p>
        </section>
        <section class="card fence-card">
          <p class="eyebrow">{{ 'settings.fenceEyebrow' | t }}</p>
          <h2>{{ 'settings.fenceHeading' | t }}</h2>
          <p class="muted small">{{ 'settings.fenceText' | t }}</p>
          <label
            >{{ 'settings.fencePreset' | t }}
            <select
              [attr.aria-label]="'settings.fencePresetAria' | t"
              [ngModel]="store.settings().defaultFencePreset || 'high_school'"
              (ngModelChange)="setFencePreset($event)"
            >
              <option value="high_school">{{ 'settings.fenceOption.high_school' | t }}</option>
              <option value="college">{{ 'settings.fenceOption.college' | t }}</option>
              <option value="little_league">{{ 'settings.fenceOption.little_league' | t }}</option>
              <option value="softball">{{ 'settings.fenceOption.softball' | t }}</option>
            </select>
          </label>
          <div class="fence-summary-pills">
            <div class="fence-marker-pill">
              <span>LF</span><strong>{{ currentFencePreset.leftLineFeet }}'</strong>
            </div>
            <div class="fence-marker-pill">
              <span>LCF</span><strong>{{ currentFencePreset.leftCenterFeet }}'</strong>
            </div>
            <div class="fence-marker-pill">
              <span>CF</span><strong>{{ currentFencePreset.centerFeet }}'</strong>
            </div>
            <div class="fence-marker-pill">
              <span>RCF</span><strong>{{ currentFencePreset.rightCenterFeet }}'</strong>
            </div>
            <div class="fence-marker-pill">
              <span>RF</span><strong>{{ currentFencePreset.rightLineFeet }}'</strong>
            </div>
          </div>
          <p class="muted small" style="margin-top: 12px;">{{ 'settings.fenceReportsNote' | t }}</p>
        </section>
        <section class="card visual-card">
          <p class="eyebrow">{{ 'settings.visualEyebrow' | t }}</p>
          <h2>{{ 'settings.appearance' | t }}</h2>
          <p class="muted small">{{ 'settings.visualText' | t }}</p>

          <fieldset class="setting-group" style="margin-top: 16px; border: 0; padding: 0;">
            <legend class="eyebrow" style="margin-bottom: 8px;">
              {{ 'settings.paletteLegend' | t }}
            </legend>
            <div
              class="visual-options"
              role="radiogroup"
              [attr.aria-label]="'settings.paletteAria' | t"
            >
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
                  <strong>{{ 'settings.paletteStandard' | t }}</strong>
                  <p class="small muted">{{ 'settings.paletteStandardText' | t }}</p>
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
                  <strong>{{ 'settings.paletteColorblind' | t }}</strong>
                  <p class="small muted">{{ 'settings.paletteColorblindText' | t }}</p>
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
                  <strong>{{ 'settings.paletteHighContrast' | t }}</strong>
                  <p class="small muted">{{ 'settings.paletteHighContrastText' | t }}</p>
                </div>
              </label>
            </div>
          </fieldset>

          <fieldset class="setting-group" style="margin-top: 18px; border: 0; padding: 0;">
            <legend class="eyebrow" style="margin-bottom: 8px;">
              {{ 'settings.surfaceLegend' | t }}
            </legend>
            <div
              class="visual-options"
              role="radiogroup"
              [attr.aria-label]="'settings.surfaceAria' | t"
            >
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
                  <strong>{{ 'settings.themeClassic' | t }}</strong>
                  <p class="small muted">{{ 'settings.themeClassicText' | t }}</p>
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
                  <strong>{{ 'settings.themeSlate' | t }}</strong>
                  <p class="small muted">{{ 'settings.themeSlateText' | t }}</p>
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
              {{ 'settings.shapeMarkers' | t }}
            </label>
            <p class="small muted" style="margin-top: 4px; margin-left: 28px;">
              {{ 'settings.shapeMarkersText' | t }}
            </p>
          </div>
        </section>
        <app-pro-license-card />
        <section class="card data-card">
          <p class="eyebrow">{{ 'home.takeNotebookEyebrow' | t }}</p>
          <h2>{{ 'settings.takeNotebookHeading' | t }}</h2>
          <p class="philosophy-quote">{{ 'home.philosophy' | t }}</p>
          <p class="platform-statement muted small">{{ 'home.crossPlatform' | t }}</p>

          <div
            class="backup-status-pill"
            [class.unbacked]="store.unbackedWork().hasSubstantialWork"
          >
            @if (store.unbackedWork().hasSubstantialWork) {
              <span class="status-indicator warning" aria-hidden="true">●</span>
              <div>
                <strong>{{ 'settings.backupRecommended' | t }}</strong>
                {{ i18n.unbackedSummary(store.unbackedWork()) }}.
                <p class="small muted">{{ 'settings.backupWhere' | t }}</p>
              </div>
            } @else if (store.lastBackupAt()) {
              <span class="status-indicator up-to-date" aria-hidden="true">✓</span>
              <div>
                <strong>{{ 'settings.backedUp' | t }}</strong>
                <p class="small muted">
                  {{
                    'settings.lastSaved' | t: { date: (store.lastBackupAt() | localDate: 'medium') }
                  }}
                </p>
              </div>
            } @else {
              <span class="status-indicator" aria-hidden="true">○</span>
              <div>
                <strong>{{ 'settings.notBackedUp' | t }}</strong>
                <p class="small muted">{{ 'settings.notBackedUpText' | t }}</p>
              </div>
            }
          </div>

          <div class="data-counts">
            <span
              ><strong>{{ store.teams().length }}</strong>
              {{ 'home.countTeams' | t: { count: store.teams().length } }}</span
            ><span
              ><strong>{{ store.players().length }}</strong>
              {{ 'home.countPlayers' | t: { count: store.players().length } }}</span
            ><span
              ><strong>{{ store.sessions().length }}</strong>
              {{ 'home.countPractices' | t: { count: store.sessions().length } }}</span
            ><span
              ><strong>{{ store.events().length }}</strong>
              {{ 'home.countContacts' | t: { count: store.events().length } }}</span
            >
          </div>
          <div class="row">
            @if (canShare()) {
              <button class="primary" (click)="shareBackup()">
                {{ 'settings.shareNotebook' | t }}
              </button>
              <button (click)="exportJson()">{{ 'settings.exportJson' | t }}</button>
            } @else {
              <button class="primary" (click)="exportJson()">
                {{ 'settings.exportJson' | t }}
              </button>
              <button (click)="shareBackup()">{{ 'settings.shareNotebook' | t }}</button>
            }
          </div>
          <p class="muted small share-hint">
            @if (canShare()) {
              {{ 'settings.shareHintIntro' | t }}
              <strong>{{ 'settings.shareHintIosTarget' | t }}</strong>
              {{ 'settings.shareHintIosAlt' | t }}
              <strong>{{ 'settings.shareHintAndroidTarget' | t }}</strong>
              {{ 'settings.shareHintAndroidAlt' | t }}
            } @else {
              {{ 'settings.downloadHint' | t }}
            }
          </p>
          <div class="csv-row">
            <label
              >{{ 'settings.csvScope' | t
              }}<select [attr.aria-label]="'settings.csvScope' | t" [(ngModel)]="csvScope">
                <option value="team">{{ 'settings.csvScopeTeam' | t }}</option>
                <option value="all">{{ 'settings.csvScopeAll' | t }}</option>
              </select></label
            ><button (click)="exportCsv()">{{ 'settings.exportAllCsv' | t }}</button>
          </div>
          <p class="muted small">{{ 'settings.csvHint' | t }}</p>
          @if (entitlement.canAccess('enriched_csv_metrics')) {
            <p class="small pro-export-note">
              <span class="pro-tag">✦ PRO</span> {{ 'pro.csv.included' | t }}
            </p>
          } @else {
            <p class="small pro-export-note">
              <span class="pro-tag">✦ PRO</span> {{ 'pro.csv.adds' | t }}
              <button
                type="button"
                class="text-button"
                (click)="upsell.open('enriched_csv_metrics')"
              >
                {{ 'pro.csv.see' | t }}
              </button>
            </p>
          }
        </section>
        <section class="card">
          <p class="eyebrow">{{ 'settings.restoreEyebrow' | t }}</p>
          <h2>{{ 'home.openNotebookBtn' | t }}</h2>
          <p class="muted">{{ 'settings.restoreText' | t }}</p>
          <label
            >{{ 'settings.importJson' | t
            }}<input type="file" accept=".json,application/json" (change)="readBackup($event)"
          /></label>
          <p class="small muted">{{ 'settings.restoreTip' | t }}</p>
          @if (importError()) {
            <p role="alert" class="error">{{ importError() }}</p>
          }
          @if (preview()) {
            <div class="import-box">
              <h3>{{ 'settings.readyToMerge' | t }}</h3>
              <p>
                {{ 'backup.teams' | t: { count: preview()!.counts.teams } }} ·
                {{ 'backup.players' | t: { count: preview()!.counts.players } }} ·
                {{ 'backup.practices' | t: { count: preview()!.counts.sessions } }} ·
                {{ 'backup.contacts' | t: { count: preview()!.counts.events } }} ·
                {{ 'backup.notes' | t: { count: preview()!.counts.notes } }}
              </p>
              <p class="small muted">
                {{ 'settings.conflicts' | t: { count: preview()!.conflicts } }}
              </p>
              @for (warning of preview()!.warnings; track warning) {
                <p class="small">{{ warning }}</p>
              }
              <div class="row">
                <button class="primary" [disabled]="busy()" (click)="applyImport()">
                  {{ 'settings.mergeBackup' | t }}</button
                ><button (click)="preview.set(null)">{{ 'common.cancel' | t }}</button>
              </div>
            </div>
          }
        </section>
        <section class="card">
          <p class="eyebrow">{{ 'settings.deviceEyebrow' | t }}</p>
          <h2>{{ 'settings.deviceHeading' | t }}</h2>
          <p class="muted">{{ 'settings.offlineText' | t }}</p>
          <p class="small cross-platform-note">{{ 'home.crossPlatform' | t }}</p>
          @if (installPrompt()) {
            <button class="primary" (click)="install()">{{ 'settings.install' | t }}</button>
          } @else {
            <p class="small">
              {{ 'settings.installIntro' | t }} <strong>{{ 'settings.installMenu' | t }}</strong>
              {{ 'settings.installIos' | t }} <strong>{{ 'settings.installIosSteps' | t }}</strong
              >.
            </p>
          }
          <button (click)="protectStorage()">{{ 'settings.requestPersistence' | t }}</button>
          <p class="small muted">
            {{ storageStatus() || ('settings.persistenceHelp' | t) }}
          </p>
          <p class="small muted">
            {{ 'settings.version' | t }}<br />{{ 'settings.noAccount' | t }}
          </p>
          <p class="small">
            <a routerLink="/privacy">{{ 'settings.privacyLink' | t }}</a>
          </p>
        </section>
        <section class="card danger-card">
          <h2>{{ 'settings.clearHeading' | t }}</h2>
          <p class="muted">{{ 'settings.clearText' | t }}</p>
          <label
            >{{ 'settings.clearConfirmLabel' | t
            }}<input [(ngModel)]="deleteText" autocomplete="off" placeholder="DELETE" /></label
          ><button
            class="danger"
            [disabled]="deleteText !== 'DELETE' || busy()"
            (click)="clearData()"
          >
            {{ 'settings.clearButton' | t }}
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
            <h2 id="team-title">
              {{ (teamId ? 'settings.editTeam' : 'settings.addTeamTitle') | t }}
            </h2>
            <button
              (click)="teamEditor.set(false)"
              [attr.aria-label]="'settings.closeTeamEditor' | t"
            >
              ✕
            </button>
          </div>
          <form class="stack" (ngSubmit)="saveTeam()">
            <label
              >{{ 'home.teamName' | t
              }}<input name="teamName" [(ngModel)]="teamDraft.name" required maxlength="100"
            /></label>
            <div class="form-grid">
              <label
                >{{ 'home.shortName' | t
                }}<input name="shortName" [(ngModel)]="teamDraft.shortName" maxlength="20" /></label
              ><label
                >{{ 'home.season' | t
                }}<input name="season" [(ngModel)]="teamDraft.season" maxlength="40"
              /></label>
            </div>
            <div class="logo-upload-group">
              <span
                >{{ 'settings.teamLogo' | t }}
                <span class="muted small">{{ 'home.optional' | t }}</span></span
              >
              @if (teamDraft.logoUrl) {
                <div class="logo-preview-row">
                  <img
                    [src]="teamDraft.logoUrl"
                    [alt]="'settings.logoPreviewAlt' | t"
                    class="logo-thumb"
                  />
                  <button type="button" class="text-button" (click)="removeLogo()">
                    {{ 'settings.removeLogo' | t }}
                  </button>
                </div>
              } @else {
                <label>
                  <input
                    type="file"
                    accept="image/*"
                    (change)="onLogoSelected($event)"
                    [attr.aria-label]="'settings.uploadLogo' | t"
                  />
                </label>
                <span class="small muted">{{ 'settings.logoHint' | t }}</span>
              }
            </div>
            <label
              >{{ 'settings.teamNotes' | t
              }}<textarea name="notes" [(ngModel)]="teamDraft.notes" maxlength="10000"></textarea>
            </label>
            <div class="row">
              <button class="primary" [disabled]="!teamDraft.name.trim() || busy()">
                {{ 'settings.saveTeam' | t }}</button
              ><button type="button" (click)="teamEditor.set(false)">
                {{ 'common.cancel' | t }}
              </button>
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
    .visual-options {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin: 14px 0;
    }
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
    .visual-option.selected {
      border-color: var(--green);
      background: #f4f7ee;
    }
    .visual-option input[type='radio'] {
      margin-top: 3px;
      accent-color: var(--green);
    }
    .visual-option strong {
      display: block;
      font-size: 14px;
      color: var(--ink);
    }
    .visual-option p {
      margin: 2px 0 0;
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
    .fence-summary-pills {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-top: 14px;
    }
    .fence-marker-pill {
      flex: 1;
      min-width: 48px;
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 8px 6px;
      text-align: center;
    }
    .fence-marker-pill span {
      display: block;
      font-size: 10px;
      font-weight: 700;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .fence-marker-pill strong {
      display: block;
      font-size: 14px;
      color: var(--ink);
      margin-top: 2px;
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
  readonly i18n = inject(I18nService);
  readonly entitlement = inject(EntitlementService);
  readonly upsell = inject(ProUpsellService);
  readonly message = signal('');
  readonly importError = signal('');
  readonly preview = signal<ImportPreview | null>(null);
  readonly busy = signal(false);
  readonly teamEditor = signal(false);
  readonly installer = inject(InstallService);
  readonly installPrompt = this.installer.prompt;
  readonly storageStatus = signal('');
  readonly canShare = signal(canShareFiles());
  readonly fencePresets = STANDARD_FENCE_PRESETS;
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

  get currentFencePreset(): OutfieldFenceConfig {
    const presetKey = this.store.settings().defaultFencePreset;
    if (presetKey && presetKey in this.fencePresets) {
      return this.fencePresets[presetKey as keyof typeof this.fencePresets];
    }
    return this.fencePresets.high_school;
  }

  async setFencePreset(preset: FieldPresetKey) {
    if (preset in this.fencePresets) {
      const validKey = preset as keyof typeof this.fencePresets;
      await this.store.updateSettings({ defaultFencePreset: validKey });
      this.message.set(
        this.i18n.t('settings.fenceSet', { preset: this.i18n.t('fence.' + validKey) }),
      );
    }
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
    this.message.set(this.i18n.t('settings.teamSwitched'));
  }
  /** Free coaches keep every team they already have; creating another one is Pro. */
  addTeam() {
    if (this.store.teams().length >= 1 && !this.entitlement.canAccess('multi_team')) {
      this.upsell.open('multi_team');
      return;
    }
    this.editTeam();
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
      this.message.set(this.i18n.t('settings.logoNotImage'));
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
      this.message.set(this.i18n.t('settings.teamSaved'));
    } finally {
      this.busy.set(false);
    }
  }
  async exportJson() {
    const backup = await this.store.exportFreshBackup();
    downloadFile(backupJson(backup), this.backupName(), 'application/json');
    this.store.recordBackupExported();
    this.message.set(this.i18n.t('settings.jsonDownloaded'));
  }
  backupName() {
    return backupFileName();
  }
  async shareBackup() {
    const backup = await this.store.exportFreshBackup();
    const result = await shareFile(
      backupJson(backup),
      this.backupName(),
      'application/json',
      this.i18n.t('settings.shareTitle'),
      this.i18n.t('settings.shareText'),
    );
    if (result !== 'canceled') {
      this.store.recordBackupExported();
    }
    this.message.set(this.i18n.t('settings.share.' + result));
  }

  async exportCsv() {
    const backup = await this.store.exportFreshBackup();
    const events = backup.events.filter(
      (e) => this.csvScope === 'all' || e.teamId === backup.settings.activeTeamId,
    );
    downloadFile(
      eventsCsv(
        events,
        backup.teams,
        backup.sessions,
        backup.notes,
        this.entitlement.canAccess('enriched_csv_metrics')
          ? { fence: this.currentFencePreset }
          : null,
      ),
      'baseball-contacts.csv',
      'text/csv;charset=utf-8',
    );
    this.message.set(this.i18n.t('settings.csvExported', { count: events.length }));
  }
  async readBackup(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.preview.set(null);
    this.importError.set('');
    try {
      if (file) {
        if (file.size > 50_000_000) throw new Error(this.i18n.t('backup.tooLarge'));
        this.preview.set(this.store.previewImport(await file.text()));
      }
    } catch (error) {
      this.importError.set(
        error instanceof Error ? error.message : this.i18n.t('backup.unreadable'),
      );
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
      this.message.set(this.i18n.t('settings.merged'));
    } catch (error) {
      this.importError.set(
        error instanceof Error ? error.message : this.i18n.t('backup.importFailed'),
      );
    } finally {
      this.busy.set(false);
    }
  }
  async clearData() {
    if (this.deleteText !== 'DELETE' || !window.confirm(this.i18n.t('settings.clearConfirm')))
      return;
    this.busy.set(true);
    try {
      await this.store.clearAll();
      this.deleteText = '';
      this.message.set(this.i18n.t('settings.cleared'));
    } finally {
      this.busy.set(false);
    }
  }
  async protectStorage() {
    const kept = await navigator.storage?.persist?.();
    this.storageStatus.set(
      this.i18n.t(kept ? 'settings.persistenceOn' : 'settings.persistenceAuto'),
    );
  }
  async install() {
    await this.installer.install();
  }
}
