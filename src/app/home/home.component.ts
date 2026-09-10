import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoachStore } from '../data/coach-store';
import { ImportPreview } from '../data/models';
@Component({
  selector: 'app-home',
  imports: [RouterLink, DatePipe, FormsModule],
  template: ` <div class="page">
    @if (!store.activeTeam()) {
      <div class="welcome">
        <div class="welcome-art" aria-hidden="true">
          <img src="icons/mark.svg" alt="" /><span>MAKE EVERY<br />ROUND COUNT.</span>
          <p>A little less screen time.<br />A little more field time.</p>
        </div>
        <div class="welcome-panels">
          <section class="setup card">
            <p class="eyebrow">YOUR BASEBALL NOTEBOOK</p>
            <h1>Let's get to the field.</h1>
            <p class="muted">
              A team, a roster, and you're ready. Keep every contact, coaching note, and spray chart
              in your pocket.
            </p>
            <form class="stack" (ngSubmit)="createTeam()">
              <label
                >Team name<input
                  name="teamName"
                  [(ngModel)]="name"
                  required
                  maxlength="100"
                  placeholder="e.g. Westfield Wildcats"
                  autocomplete="organization"
              /></label>
              <div class="form-grid">
                <label
                  ><span>Short name <span class="muted small">(optional)</span></span
                  ><input
                    name="shortName"
                    [(ngModel)]="shortName"
                    maxlength="20"
                    placeholder="WILDCATS" /></label
                ><label
                  ><span>Season</span
                  ><input name="season" [(ngModel)]="season" maxlength="40" placeholder="2026"
                /></label>
              </div>
              <button class="primary" [disabled]="busy() || !name.trim()">
                Create team & add players <span aria-hidden="true">→</span>
              </button>
            </form>
            <p class="privacy small">
              No account. No subscriptions. Your notebook stays on this device, and you can export
              it anytime.
            </p>
          </section>

          <section class="card receive-card">
            <p class="eyebrow">OPENING ON ANOTHER DEVICE?</p>
            <h2>Bring your notebook over</h2>
            <p class="muted small">
              Saved your notebook to iCloud Drive, Google Drive, or sent it from another coach? Pick
              up right where you left off.
            </p>
            <label class="receive-file-label button">
              <span>Choose notebook backup (.json)</span>
              <input
                type="file"
                aria-label="Choose notebook file to import"
                accept=".json,application/json"
                (change)="readWelcomeBackup($event)"
              />
            </label>
            <p class="small muted cross-platform-badge">
              Works on iPhone, iPad, Android, Windows, Mac, and Chromebook. No app store required.
            </p>
            @if (importError()) {
              <p role="alert" class="error">{{ importError() }}</p>
            }
            @if (preview()) {
              <div class="welcome-preview-box">
                <h3>Ready to open</h3>
                <p class="small">
                  <strong>{{ preview()!.counts.teams }}</strong> teams ·
                  <strong>{{ preview()!.counts.players }}</strong> players ·
                  <strong>{{ preview()!.counts.sessions }}</strong> practices ·
                  <strong>{{ preview()!.counts.events }}</strong> contacts
                </p>
                <div class="row">
                  <button class="primary" [disabled]="busy()" (click)="applyWelcomeImport()">
                    Open notebook on this device
                  </button>
                  <button type="button" (click)="preview.set(null)">Cancel</button>
                </div>
              </div>
            }
          </section>
        </div>
      </div>
    } @else {
      <div class="home-heading">
        <div>
          <p class="eyebrow">
            {{ store.activeTeam()!.season || 'YOUR SEASON' }} · THE COACH'S NOTEBOOK
          </p>
          <h1>{{ store.activeTeam()!.name }}</h1>
          <p class="muted">Good habits start with a good round.</p>
        </div>
        <div class="team-emblem-badge">
          @if (store.activeTeam()!.logoUrl) {
            <img
              class="team-logo-img"
              [src]="store.activeTeam()!.logoUrl"
              [alt]="store.activeTeam()!.name + ' logo'"
            />
          } @else {
            <div class="team-crest" [title]="store.activeTeam()!.name">
              <div class="team-crest-diamond" aria-hidden="true"></div>
              <div class="team-crest-inner">
                <span class="team-crest-monogram">{{ teamMonogram() }}</span>
                <span class="team-crest-season">{{ store.activeTeam()!.season || 'BP' }}</span>
              </div>
            </div>
          }
          <a routerLink="/settings" class="change-logo-link">{{
            store.activeTeam()!.logoUrl ? 'Change logo' : 'Add logo'
          }}</a>
        </div>
      </div>
      <section class="practice-hero">
        <div>
          <span class="hero-tag">BATTING PRACTICE</span>
          <h2>
            {{
              store.activeSession()
                ? 'Pick up where you left off.'
                : 'Eyes on the hitter.
We’ll keep the notebook.'
            }}
          </h2>
          <p>
            {{
              store.activeSession()
                ? 'Your batting order and recorded contacts are saved.'
                : 'Tap where it lands. Add the details you want. Keep the round moving.'
            }}
          </p>
          @if (store.activeSession()) {
            <a class="button accent" routerLink="/practice"
              >Resume Practice <span aria-hidden="true">→</span></a
            >
          } @else if (store.roster().length) {
            <a class="button accent" routerLink="/practice"
              >Start Practice <span aria-hidden="true">→</span></a
            >
          } @else {
            <a class="button accent" routerLink="/roster" [queryParams]="{ setup: 1 }"
              >Add your players <span aria-hidden="true">→</span></a
            >
          }
        </div>
        <div class="hero-diamond" aria-hidden="true"><span></span><i></i><b></b></div>
      </section>
      <div class="context-row">
        <span
          ><strong>{{ store.roster().length }}</strong> active players</span
        ><span
          ><strong>{{ sessions().length }}</strong> practices</span
        ><span
          ><strong>{{ contactCount() }}</strong> recorded contacts</span
        >
      </div>
      <div class="home-grid">
        <section>
          <div class="section-heading">
            <h2>Recent practices</h2>
            <a routerLink="/reports">All reports →</a>
          </div>
          @for (session of sessions().slice(0, 5); track session.id) {
            <a class="session-row" routerLink="/reports" [queryParams]="{ session: session.id }"
              ><div class="date-box">
                <strong>{{ session.startedAt | date: 'dd' }}</strong
                ><span>{{ session.startedAt | date: 'MMM' }}</span>
              </div>
              <div>
                <h3>{{ session.title || 'Batting practice' }}</h3>
                <span class="muted small"
                  >{{ session.startedAt | date: 'EEE, h:mm a' }} ·
                  {{ count(session.id) }} contacts</span
                >
              </div>
              <span class="badge">{{ session.endedAt ? 'Review' : 'In progress' }}</span></a
            >
          } @empty {
            <div class="card empty">
              <h3>Your next round starts here.</h3>
              <p class="muted">
                Practice sessions and player spray charts will show up as you record contacts.
              </p>
            </div>
          }
        </section>
        <aside class="coach-note card">
          <p class="eyebrow">TAKE YOUR NOTEBOOK WITH YOU</p>
          <h2>Watch the ball.<br />Mark the spot.</h2>
          <p class="muted small philosophy-blurb">
            “Pinch Hitter doesn't keep your data on our servers. Your notebook stays on your devices
            and in whatever storage provider you trust.”
          </p>
          <hr />
          @if (store.unbackedWork().hasSubstantialWork) {
            <div class="unbacked-flag">
              <span class="unbacked-dot" aria-hidden="true">●</span>
              <div>
                <strong>Backup recommended</strong>
                <p class="small muted">{{ store.unbackedWork().summary }}.</p>
              </div>
            </div>
            <a routerLink="/settings" class="button primary unbacked-btn"
              >Take notebook with you →</a
            >
          } @else {
            <p class="small muted">
              {{
                store.lastBackupAt()
                  ? 'Notebook is backed up to your storage.'
                  : 'Make a backup after practice to keep a copy off this device.'
              }}
            </p>
            <a routerLink="/settings">Take your notebook with you →</a>
          }
        </aside>
      </div>
    }
  </div>`,
  styles: `
    .welcome {
      display: grid;
      grid-template-columns: 0.8fr 1fr;
      gap: 28px;
      max-width: 960px;
      margin: 24px auto;
    }
    .welcome-art {
      border-radius: 18px;
      background: var(--green);
      color: #fff8de;
      padding: 48px 36px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .welcome-art img {
      width: 84px;
      margin-bottom: 36px;
    }
    .welcome-art span {
      font-weight: 900;
      font-size: 44px;
      letter-spacing: -1.5px;
      line-height: 1.05;
    }
    .welcome-art p {
      color: #d8e5d7;
      margin-top: 28px;
    }
    .setup {
      padding: 36px;
    }
    .privacy {
      margin-top: 24px;
      color: var(--muted);
    }
    .home-heading {
      display: flex;
      justify-content: space-between;
      gap: 20px;
      align-items: center;
    }
    .team-emblem-badge {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }
    .team-crest {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #255442, #132b23);
      border: 3px solid #dfd8be;
      box-shadow:
        0 4px 12px rgba(19, 43, 35, 0.25),
        inset 0 0 0 2px #1c4234;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      color: #fff9e6;
    }
    .team-crest-diamond {
      position: absolute;
      width: 50px;
      height: 50px;
      border: 1px dashed rgba(223, 216, 190, 0.35);
      transform: rotate(45deg);
    }
    .team-crest-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }
    .team-crest-monogram {
      font-family: ui-serif, Georgia, 'Times New Roman', serif;
      font-size: 1.55rem;
      font-weight: 900;
      letter-spacing: 1px;
      line-height: 1;
      color: #f7e096;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.6);
    }
    .team-crest-season {
      font-size: 0.52rem;
      font-weight: 750;
      letter-spacing: 1.5px;
      color: #c0cfc5;
      text-transform: uppercase;
      margin-top: 3px;
    }
    .team-logo-img {
      width: 84px;
      height: 84px;
      object-fit: contain;
      border-radius: 12px;
      background: #fff;
      padding: 6px;
      border: 1px solid var(--line);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }
    .change-logo-link {
      font-size: 0.66rem;
      color: var(--muted);
      text-decoration: none;
      font-weight: 600;
      padding: 2px 6px;
    }
    .change-logo-link:hover {
      text-decoration: underline;
      color: var(--green);
    }
    .practice-hero {
      margin-top: 14px;
      position: relative;
      overflow: hidden;
      min-height: 300px;
      background: var(--ink);
      border-radius: 18px;
      color: white;
      padding: 36px;
      display: flex;
      align-items: center;
    }
    .hero-tag {
      color: #d6deb9;
      font-size: 11px;
      letter-spacing: 2px;
      font-weight: 800;
    }
    .practice-hero h2 {
      font-size: clamp(26px, 4vw, 38px);
      line-height: 1.12;
      letter-spacing: -1px;
      white-space: pre-line;
      margin: 16px 0;
    }
    .practice-hero p {
      color: #d6e0d4;
      max-width: 400px;
    }
    .practice-hero > div:first-child {
      position: relative;
      z-index: 1;
    }
    .hero-diamond {
      position: absolute;
      right: 3%;
      top: 0;
      width: 330px;
      height: 330px;
      transform: rotate(45deg);
      border: 1px solid #688269;
      background: linear-gradient(135deg, #234d39, #172f2b);
      border-radius: 100% 0 0;
    }
    .hero-diamond span {
      position: absolute;
      width: 135px;
      height: 135px;
      border: 2px solid #bfbc97;
      right: 40px;
      bottom: 40px;
      background: #a4794140;
    }
    .hero-diamond i,
    .hero-diamond b {
      position: absolute;
      width: 12px;
      height: 12px;
      background: #f4ecd5;
      bottom: 34px;
      right: 34px;
    }
    .hero-diamond b {
      bottom: 167px;
      right: 167px;
    }
    .context-row {
      display: flex;
      gap: 28px;
      flex-wrap: wrap;
      padding: 20px 2px;
      border-bottom: 1px solid var(--line);
      font-size: 13px;
      color: var(--muted);
    }
    .context-row strong {
      color: var(--ink);
      margin-right: 3px;
    }
    .home-grid {
      display: grid;
      grid-template-columns: 1.8fr 1fr;
      gap: 32px;
    }
    .coach-note {
      margin-top: 30px;
      background: #efefdf;
    }
    .welcome-panels {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .receive-card {
      background: #ecefdf;
      border-color: #d8deca;
    }
    .receive-file-label {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      position: relative;
      margin-top: 14px;
      font-weight: 700;
    }
    .receive-file-label input[type='file'] {
      position: absolute;
      left: 0;
      top: 0;
      opacity: 0;
      width: 100%;
      height: 100%;
      cursor: pointer;
    }
    .cross-platform-badge {
      margin-top: 14px;
      line-height: 1.35;
      font-weight: 500;
      color: #3b5a45;
    }
    .welcome-preview-box {
      margin-top: 16px;
      padding-top: 14px;
      border-top: 1px solid var(--line);
    }
    .welcome-preview-box .row {
      margin-top: 14px;
    }
    .philosophy-blurb {
      font-style: italic;
      line-height: 1.35;
      margin-top: 8px;
    }
    .unbacked-flag {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      background: #fdf5ea;
      border: 1px solid #ebd2a4;
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 12px;
      font-size: 12px;
    }
    .unbacked-dot {
      color: #b8621b;
      font-size: 13px;
      line-height: 1.2;
    }
    .unbacked-flag p {
      margin: 2px 0 0;
    }
    .unbacked-btn {
      display: block;
      text-align: center;
    }
    .coach-note h2 {
      line-height: 1.25;
    }
    .coach-note hr {
      border: 0;
      border-top: 1px solid var(--line);
      margin: 24px 0;
    }
    .session-row {
      display: flex;
      gap: 16px;
      align-items: center;
      border-bottom: 1px solid var(--line);
      padding: 16px 0;
      text-decoration: none;
      color: var(--ink);
    }
    .session-row h3 {
      margin: 0 0 4px;
    }
    .session-row .badge {
      margin-left: auto;
    }
    .date-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--cream);
      width: 54px;
      height: 60px;
      border-radius: 9px;
      flex-shrink: 0;
    }
    .date-box strong {
      font-size: 23px;
    }
    .date-box span {
      text-transform: uppercase;
      font-size: 10px;
      font-weight: 800;
    }
    @media (max-width: 700px) {
      .welcome {
        grid-template-columns: 1fr;
        margin: 0;
      }
      .welcome-art {
        display: none;
      }
      .setup {
        padding: 24px;
      }
      .home-grid {
        grid-template-columns: 1fr;
        gap: 0;
      }
      .practice-hero {
        padding: 27px;
        min-height: 320px;
      }
      .hero-diamond {
        right: -175px;
        opacity: 0.45;
      }
      .practice-hero p {
        max-width: 245px;
      }
      .team-crest {
        width: 68px;
        height: 68px;
      }
      .team-crest-monogram {
        font-size: 1.3rem;
      }
      .team-logo-img {
        width: 70px;
        height: 70px;
      }
      .context-row {
        gap: 13px;
        font-size: 11px;
      }
      .session-row {
        gap: 11px;
      }
      .session-row h3 {
        font-size: 15px;
      }
      .session-row .badge {
        font-size: 10px;
      }
      .coach-note {
        margin-top: 24px;
      }
    }
  `,
})
export class HomeComponent {
  readonly store = inject(CoachStore);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly preview = signal<ImportPreview | null>(null);
  readonly importError = signal('');
  name = '';
  shortName = '';
  season = String(new Date().getFullYear());
  readonly teamMonogram = computed(() => {
    const team = this.store.activeTeam();
    if (!team) return 'PH';
    if (team.shortName && team.shortName.length <= 4) return team.shortName;
    const parts = team.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return team.name.slice(0, 3).toUpperCase();
  });
  readonly sessions = computed(() =>
    this.store
      .sessions()
      .filter((s) => s.teamId === this.store.activeTeam()?.id)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
  );
  readonly contactCount = computed(
    () => this.store.events().filter((e) => e.teamId === this.store.activeTeam()?.id).length,
  );
  count(id: string) {
    return this.store.events().filter((e) => e.sessionId === id).length;
  }
  async createTeam() {
    if (!this.name.trim() || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.addTeam({
        name: this.name.trim(),
        shortName: this.shortName.trim(),
        season: this.season.trim(),
        notes: '',
      });
      await this.router.navigate(['/roster'], { queryParams: { setup: 1 } });
    } finally {
      this.busy.set(false);
    }
  }
  async readWelcomeBackup(event: Event) {
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
  async applyWelcomeImport() {
    const preview = this.preview();
    if (!preview || this.busy()) return;
    this.busy.set(true);
    try {
      await this.store.importBackup(preview);
      this.preview.set(null);
    } catch (error) {
      this.importError.set(
        error instanceof Error ? error.message : 'Import failed. Existing data was preserved.',
      );
    } finally {
      this.busy.set(false);
    }
  }
}
