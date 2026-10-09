import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ModalDirective } from '../shared/modal.directive';
import { CoachStore } from '../data/coach-store';
import { Player, Hand, RosterPreview } from '../data/models';
import { parseRosterCsv } from '../data/transfer';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
@Component({
  selector: 'app-roster',
  imports: [FormsModule, RouterLink, ModalDirective, TranslatePipe],
  template: `
    <div class="page">
      <p class="eyebrow">{{ store.activeTeam()?.name || ('roster.yourTeam' | t) }}</p>
      <div class="section-heading top">
        <div>
          <h1>{{ 'roster.heading' | t }}</h1>
          <p class="muted">{{ 'roster.subtitle' | t }}</p>
        </div>
        <button class="primary" (click)="edit()" [disabled]="!store.activeTeam()">
          {{ 'roster.addPlayerBtn' | t }}
        </button>
      </div>
      @if (!store.activeTeam()) {
        <div class="card empty">
          <h2>{{ 'roster.noTeamHeading' | t }}</h2>
          <a class="button primary" routerLink="/">{{ 'roster.setUpTeam' | t }}</a>
        </div>
      } @else {
        @if (setup) {
          <div class="notice">
            <strong>{{ 'roster.setupNoticeStrong' | t }}</strong>
            {{ 'roster.setupNoticeText' | t }}
          </div>
        }
        <div class="roster-layout">
          <section>
            <div class="roster-toolbar">
              <span class="eyebrow">{{
                'roster.activeCount' | t: { count: activePlayers().length }
              }}</span
              ><label class="check-label"
                ><input type="checkbox" [(ngModel)]="showArchived" />{{
                  'roster.showArchived' | t
                }}</label
              >
            </div>
            @for (player of visiblePlayers(); track player.id; let i = $index) {
              <article class="player-row">
                <span class="jersey">{{ player.jerseyNumber || '—' }}</span>
                <div class="player-info">
                  <a routerLink="/reports" [queryParams]="{ player: player.id }">{{
                    player.name
                  }}</a>
                  <p>
                    {{ 'roster.bats.' + player.bats | t }}
                    · {{ player.positions.join(' / ') || ('roster.noPosition' | t) }}
                    @if (!player.active) {
                      <span class="badge">{{ 'roster.archived' | t }}</span>
                    }
                  </p>
                </div>
                <div class="player-controls">
                  @if (player.active) {
                    <button
                      class="move"
                      [disabled]="i === 0"
                      (click)="move(player.id, -1)"
                      [attr.aria-label]="'roster.moveUp' | t: { name: player.name }"
                    >
                      ↑</button
                    ><button
                      class="move"
                      [disabled]="i === activePlayers().length - 1"
                      (click)="move(player.id, 1)"
                      [attr.aria-label]="'roster.moveDown' | t: { name: player.name }"
                    >
                      ↓
                    </button>
                  }
                  <button
                    (click)="edit(player)"
                    [attr.aria-label]="'roster.editAria' | t: { name: player.name }"
                  >
                    {{ 'roster.edit' | t }}
                  </button>
                </div>
              </article>
            } @empty {
              <div class="card empty">
                <h2>{{ 'roster.emptyHeading' | t }}</h2>
                <p class="muted">{{ 'roster.emptyText' | t }}</p>
              </div>
            }
            @if (activePlayers().length) {
              <p class="muted small">{{ 'roster.orderHelp' | t }}</p>
              <a class="button accent" routerLink="/practice"
                >{{
                  (store.activeSession() ? 'home.resumePracticeBtn' : 'home.startPracticeBtn') | t
                }}
                →</a
              >
            }
          </section>
          <aside class="card quick-add">
            <p class="eyebrow">{{ 'roster.quickEyebrow' | t }}</p>
            <h2>{{ 'roster.quickHeading' | t }}</h2>
            <p class="muted small">{{ 'roster.quickText' | t }}</p>
            <label
              >{{ 'roster.playerList' | t
              }}<textarea
                [(ngModel)]="bulkText"
                [placeholder]="'roster.listPlaceholder' | t"
                rows="5"
              ></textarea>
            </label>
            <div class="row">
              <button (click)="previewText()" [disabled]="!bulkText.trim()">
                {{ 'roster.previewPlayers' | t }}</button
              ><label class="button file-label"
                >{{ 'roster.chooseCsv' | t
                }}<input type="file" accept=".csv,text/csv" (change)="readCsv($event)"
              /></label>
            </div>
            @if (preview()) {
              <section class="import-preview" [attr.aria-label]="'roster.previewAria' | t">
                <h3>{{ 'roster.toAdd' | t: { count: preview()!.rows.length } }}</h3>
                @for (error of preview()!.errors; track $index) {
                  <p class="error small">{{ error }}</p>
                }
                @for (row of preview()!.rows; track $index) {
                  <div class="preview-row">
                    <strong>{{ row.name }}</strong
                    ><span>#{{ row.jerseyNumber || '—' }} · {{ row.bats }}</span>
                  </div>
                }
                <button
                  class="primary"
                  (click)="importPlayers()"
                  [disabled]="!!preview()!.errors.length || !preview()!.rows.length || busy()"
                >
                  {{ 'roster.addCountPlayers' | t: { count: preview()!.rows.length } }}</button
                ><button class="text-button" (click)="preview.set(null)">
                  {{ 'common.cancel' | t }}
                </button>
              </section>
            }
          </aside>
        </div>
      }
      @if (message()) {
        <p role="status" class="notice">{{ message() }}</p>
      }
    </div>
    @if (editorOpen()) {
      <div class="sheet-backdrop">
        <section
          appModal
          class="sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="player-editor-title"
          (keydown.escape)="editorOpen.set(false)"
        >
          <div class="sheet-header">
            <h2 id="player-editor-title">
              {{ (editingId ? 'roster.editPlayer' : 'roster.addPlayer') | t }}
            </h2>
            <button (click)="editorOpen.set(false)" [attr.aria-label]="'roster.closeEditor' | t">
              ✕
            </button>
          </div>
          <form class="stack" (ngSubmit)="savePlayer()">
            <label
              >{{ 'roster.playerName' | t
              }}<input
                name="playerName"
                [(ngModel)]="draft.name"
                required
                maxlength="100"
                autocomplete="off"
            /></label>
            <div class="form-grid">
              <label
                >{{ 'roster.jerseyNumber' | t
                }}<input
                  name="jersey"
                  [(ngModel)]="draft.jerseyNumber"
                  maxlength="12"
                  inputmode="numeric" /></label
              ><label
                >{{ 'roster.grade' | t
                }}<input name="grade" [(ngModel)]="draft.grade" maxlength="30" /></label
              ><label
                >{{ 'roster.bats' | t
                }}<select
                  [attr.aria-label]="'roster.bats' | t"
                  name="bats"
                  [(ngModel)]="draft.bats"
                >
                  <option value="R">{{ 'baseball.right' | t }}</option>
                  <option value="L">{{ 'baseball.left' | t }}</option>
                  <option value="S">{{ 'baseball.switch' | t }}</option>
                </select></label
              ><label
                >{{ 'roster.throws' | t
                }}<select
                  [attr.aria-label]="'roster.throws' | t"
                  name="throws"
                  [(ngModel)]="draft.throws"
                >
                  <option value="R">{{ 'baseball.right' | t }}</option>
                  <option value="L">{{ 'baseball.left' | t }}</option>
                  <option value="S">{{ 'baseball.switch' | t }}</option>
                </select></label
              >
            </div>
            <fieldset>
              <legend>{{ 'roster.positions' | t }}</legend>
              <div class="positions">
                @for (position of positions; track position) {
                  <label class="check-label"
                    ><input
                      type="checkbox"
                      [checked]="draft.positions.includes(position)"
                      (change)="togglePosition(position)"
                    />{{
                      labeledPositions.includes(position)
                        ? ('roster.pos.' + position | t)
                        : position
                    }}</label
                  >
                }
              </div>
            </fieldset>
            <label
              >{{ 'roster.notes' | t
              }}<textarea
                name="notes"
                [(ngModel)]="draft.notes"
                [placeholder]="'roster.notesPlaceholder' | t"
                maxlength="10000"
              ></textarea>
            </label>
            <div class="row">
              <button class="primary" [disabled]="!draft.name.trim() || busy()">
                {{ 'roster.savePlayer' | t }}</button
              ><button type="button" (click)="editorOpen.set(false)">
                {{ 'common.cancel' | t }}
              </button>
              @if (editingId) {
                <button type="button" class="danger" (click)="archive()">
                  {{ (draft.active ? 'roster.archivePlayer' : 'roster.reactivatePlayer') | t }}
                </button>
              }
            </div>
          </form>
        </section>
      </div>
    }
  `,
  styles: `
    .top {
      margin-top: 0;
    }
    .top h1 {
      margin-bottom: 8px;
    }
    .top p {
      margin: 0;
    }
    .roster-layout {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 28px;
    }
    .roster-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .roster-toolbar .eyebrow {
      margin: 0;
    }
    .roster-toolbar label {
      font-size: 11px;
    }
    .player-row {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 17px 0;
      border-bottom: 1px solid var(--line);
    }
    .jersey {
      width: 48px;
      height: 52px;
      display: grid;
      place-items: center;
      flex-shrink: 0;
      background: var(--cream);
      border-radius: 9px;
      font-size: 22px;
      font-weight: 850;
      color: var(--green);
    }
    .player-info {
      flex: 1;
      min-width: 0;
    }
    .player-info a {
      font-size: 17px;
      font-weight: 750;
      text-decoration: none;
      overflow-wrap: anywhere;
    }
    .player-info p {
      font-size: 11px;
      color: var(--muted);
      margin: 5px 0 0;
    }
    .player-controls {
      display: flex;
      gap: 4px;
    }
    .player-controls button {
      padding: 8px 10px;
    }
    .player-controls .move {
      width: 44px;
    }
    .quick-add {
      align-self: start;
      background: #efefdf;
    }
    .quick-add .row {
      margin-top: 14px;
    }
    .file-label {
      position: relative;
      overflow: hidden;
      cursor: pointer;
    }
    .file-label input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .file-label:focus-within {
      outline: 3px solid var(--orange);
    }
    .import-preview {
      margin-top: 20px;
    }
    .preview-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 0;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
    }
    .import-preview button {
      margin-top: 16px;
    }
    .positions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
    }
    fieldset {
      border: 1px solid var(--line);
      border-radius: 8px;
    }
    legend {
      font-size: 13px;
      font-weight: 650;
    }
    @media (max-width: 800px) {
      .roster-layout {
        grid-template-columns: 1fr;
      }
      .top {
        align-items: start;
      }
      .top button {
        flex-shrink: 0;
      }
      .player-row {
        gap: 9px;
      }
      .player-info a {
        font-size: 15px;
      }
      .player-controls {
        gap: 2px;
      }
      .player-controls button {
        padding: 7px;
      }
      .jersey {
        width: 40px;
      }
      .quick-add {
        margin-top: 8px;
      }
    }
  `,
})
export class RosterComponent {
  readonly store = inject(CoachStore);
  private readonly i18n = inject(I18nService);
  readonly setup = inject(ActivatedRoute).snapshot.queryParamMap.has('setup');
  readonly activePlayers = computed(() => this.store.roster());
  showArchived = false;
  readonly allPlayers = computed(() =>
    this.store
      .players()
      .filter((p) => p.teamId === this.store.activeTeam()?.id)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.order - b.order),
  );
  visiblePlayers() {
    return this.allPlayers().filter((p) => this.showArchived || p.active);
  }
  readonly editorOpen = signal(false);
  readonly busy = signal(false);
  readonly message = signal('');
  readonly preview = signal<RosterPreview | null>(null);
  bulkText = '';
  readonly positions = [
    'P',
    'C',
    '1B',
    '2B',
    '3B',
    'SS',
    'LF',
    'CF',
    'RF',
    'DH',
    'IF',
    'OF',
    'UTIL',
  ];
  /** Group positions whose abbreviation is spelled out (`roster.pos.*`). */
  readonly labeledPositions = ['IF', 'OF', 'UTIL'];
  editingId = '';
  draft = this.emptyDraft();
  emptyDraft() {
    return {
      name: '',
      jerseyNumber: '',
      grade: '',
      bats: 'R' as Hand,
      throws: 'R' as Hand,
      positions: [] as string[],
      notes: '',
      active: true,
    };
  }
  edit(player?: Player) {
    this.editingId = player?.id || '';
    this.draft = player ? { ...player, positions: [...player.positions] } : this.emptyDraft();
    this.editorOpen.set(true);
  }
  togglePosition(position: string) {
    this.draft.positions = this.draft.positions.includes(position)
      ? this.draft.positions.filter((p) => p !== position)
      : [...this.draft.positions, position];
  }
  async savePlayer() {
    if (!this.draft.name.trim() || this.busy()) return;
    this.busy.set(true);
    try {
      const input = { ...this.draft, name: this.draft.name.trim() };
      if (this.editingId) await this.store.updatePlayer(this.editingId, input);
      else await this.store.addPlayer({ ...input, teamId: this.store.activeTeam()!.id });
      this.editorOpen.set(false);
      this.message.set(this.i18n.t('roster.saved'));
    } finally {
      this.busy.set(false);
    }
  }
  async archive() {
    await this.store.updatePlayer(this.editingId, { active: !this.draft.active });
    this.editorOpen.set(false);
    this.message.set(
      this.i18n.t(this.draft.active ? 'roster.archivedMessage' : 'roster.reactivatedMessage'),
    );
  }
  async move(id: string, delta: number) {
    const ids = this.activePlayers().map((p) => p.id);
    const index = ids.indexOf(id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    await this.store.reorderRoster(ids);
  }
  previewText() {
    this.preview.set(parseRosterCsv(this.bulkText));
  }
  async readCsv(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      if (file.size > 2_000_000) {
        this.message.set(this.i18n.t('roster.csvTooLarge'));
        return;
      }
      this.bulkText = await file.text();
      this.previewText();
    }
    (event.target as HTMLInputElement).value = '';
  }
  async importPlayers() {
    const preview = this.preview();
    if (!preview || preview.errors.length || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.importRoster(preview.rows);
      this.message.set(this.i18n.t('roster.added', { count: preview.rows.length }));
      this.preview.set(null);
      this.bulkText = '';
    } finally {
      this.busy.set(false);
    }
  }
}
