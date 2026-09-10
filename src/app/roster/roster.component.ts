import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ModalDirective } from '../shared/modal.directive';
import { CoachStore } from '../data/coach-store';
import { Player, Hand, RosterPreview } from '../data/models';
import { parseRosterCsv } from '../data/transfer';
@Component({
  selector: 'app-roster',
  imports: [FormsModule, RouterLink, ModalDirective],
  template: `
    <div class="page">
      <p class="eyebrow">{{ store.activeTeam()?.name || 'YOUR TEAM' }}</p>
      <div class="section-heading top">
        <div>
          <h1>The roster.</h1>
          <p class="muted">Your players. Your everyday batting order.</p>
        </div>
        <button class="primary" (click)="edit()" [disabled]="!store.activeTeam()">
          + Add player
        </button>
      </div>
      @if (!store.activeTeam()) {
        <div class="card empty">
          <h2>First, give your team a name.</h2>
          <a class="button primary" routerLink="/">Set up your team</a>
        </div>
      } @else {
        @if (setup) {
          <div class="notice">
            <strong>Next up: your players.</strong> Add names below, then head straight to practice.
          </div>
        }
        <div class="roster-layout">
          <section>
            <div class="roster-toolbar">
              <span class="eyebrow">{{ activePlayers().length }} ACTIVE PLAYERS</span
              ><label class="check-label"
                ><input type="checkbox" [(ngModel)]="showArchived" />Show archived</label
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
                    {{
                      player.bats === 'S'
                        ? 'Switch'
                        : player.bats === 'L'
                          ? 'Bats left'
                          : 'Bats right'
                    }}
                    · {{ player.positions.join(' / ') || 'Position not set' }}
                    @if (!player.active) {
                      <span class="badge">Archived</span>
                    }
                  </p>
                </div>
                <div class="player-controls">
                  @if (player.active) {
                    <button
                      class="move"
                      [disabled]="i === 0"
                      (click)="move(player.id, -1)"
                      [attr.aria-label]="'Move ' + player.name + ' up'"
                    >
                      ↑</button
                    ><button
                      class="move"
                      [disabled]="i === activePlayers().length - 1"
                      (click)="move(player.id, 1)"
                      [attr.aria-label]="'Move ' + player.name + ' down'"
                    >
                      ↓
                    </button>
                  }
                  <button (click)="edit(player)" [attr.aria-label]="'Edit ' + player.name">
                    Edit
                  </button>
                </div>
              </article>
            } @empty {
              <div class="card empty">
                <h2>Build your batting order.</h2>
                <p class="muted">Add one player at a time, paste a list, or import a roster CSV.</p>
              </div>
            }
            @if (activePlayers().length) {
              <p class="muted small">
                Use the arrows to set your default practice order. Changes during practice stay with
                that session.
              </p>
              <a class="button accent" routerLink="/practice"
                >{{ store.activeSession() ? 'Resume Practice' : 'Start Practice' }} →</a
              >
            }
          </section>
          <aside class="card quick-add">
            <p class="eyebrow">QUICK ROSTER SETUP</p>
            <h2>Bring the whole lineup.</h2>
            <p class="muted small">
              One player per line: name, jersey number. Or choose a CSV with name, jerseyNumber,
              bats, throws, grade, and positions columns.
            </p>
            <label
              >Player list<textarea
                [(ngModel)]="bulkText"
                placeholder="Marcus Williams, 12&#10;Tyler Davis, 7&#10;James Chen, 24"
                rows="5"
              ></textarea>
            </label>
            <div class="row">
              <button (click)="previewText()" [disabled]="!bulkText.trim()">Preview players</button
              ><label class="button file-label"
                >Choose CSV<input type="file" accept=".csv,text/csv" (change)="readCsv($event)"
              /></label>
            </div>
            @if (preview()) {
              <section class="import-preview" aria-label="Roster import preview">
                <h3>{{ preview()!.rows.length }} players to add</h3>
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
                  Add {{ preview()!.rows.length }} players</button
                ><button class="text-button" (click)="preview.set(null)">Cancel</button>
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
            <h2 id="player-editor-title">{{ editingId ? 'Edit player' : 'Add player' }}</h2>
            <button (click)="editorOpen.set(false)" aria-label="Close player editor">✕</button>
          </div>
          <form class="stack" (ngSubmit)="savePlayer()">
            <label
              >Player name<input
                name="playerName"
                [(ngModel)]="draft.name"
                required
                maxlength="100"
                autocomplete="off"
            /></label>
            <div class="form-grid">
              <label
                >Jersey number<input
                  name="jersey"
                  [(ngModel)]="draft.jerseyNumber"
                  maxlength="12"
                  inputmode="numeric" /></label
              ><label
                >Grade / year<input name="grade" [(ngModel)]="draft.grade" maxlength="30" /></label
              ><label
                >Bats<select aria-label="Bats" name="bats" [(ngModel)]="draft.bats">
                  <option value="R">Right</option>
                  <option value="L">Left</option>
                  <option value="S">Switch</option>
                </select></label
              ><label
                >Throws<select aria-label="Throws" name="throws" [(ngModel)]="draft.throws">
                  <option value="R">Right</option>
                  <option value="L">Left</option>
                  <option value="S">Switch</option>
                </select></label
              >
            </div>
            <fieldset>
              <legend>Positions</legend>
              <div class="positions">
                @for (position of positions; track position) {
                  <label class="check-label"
                    ><input
                      type="checkbox"
                      [checked]="draft.positions.includes(position)"
                      (change)="togglePosition(position)"
                    />{{ positionLabels[position] || position }}</label
                  >
                }
              </div>
            </fieldset>
            <label
              >Coaching notes<textarea
                name="notes"
                [(ngModel)]="draft.notes"
                placeholder="What would you like to remember?"
                maxlength="10000"
              ></textarea>
            </label>
            <div class="row">
              <button class="primary" [disabled]="!draft.name.trim() || busy()">Save player</button
              ><button type="button" (click)="editorOpen.set(false)">Cancel</button>
              @if (editingId) {
                <button type="button" class="danger" (click)="archive()">
                  {{ draft.active ? 'Archive player' : 'Reactivate player' }}
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
  readonly positionLabels: Record<string, string> = {
    IF: 'IF (Infield)',
    OF: 'OF (Outfield)',
    UTIL: 'UTIL (Utility)',
  };
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
      this.message.set('Player saved.');
    } finally {
      this.busy.set(false);
    }
  }
  async archive() {
    await this.store.updatePlayer(this.editingId, { active: !this.draft.active });
    this.editorOpen.set(false);
    this.message.set(
      this.draft.active
        ? 'Player archived. Their practice history is preserved.'
        : 'Player returned to the active roster.',
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
        this.message.set('Please choose a roster CSV smaller than 2 MB.');
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
      this.message.set(preview.rows.length + ' players added to the roster.');
      this.preview.set(null);
      this.bulkText = '';
    } finally {
      this.busy.set(false);
    }
  }
}
