import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CoachStore } from '../data/coach-store';
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
            No account. No subscriptions. Your notebook stays on this device, and you can export it
            anytime.
          </p>
          <a routerLink="/settings" class="text-button button">Already have a backup? Import it</a>
        </section>
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
        <span class="team-stamp">{{ store.activeTeam()!.shortName || 'BP' }}</span>
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
          <p class="eyebrow">ONE TAP IS ENOUGH</p>
          <h2>Watch the ball.<br />Mark the spot.</h2>
          <p class="muted">
            A location is all you need to save a contact. Contact type and result are always
            optional.
          </p>
          <hr />
          <p class="small muted">
            Your data stays with you. Make a backup after practice to keep a copy off this device.
          </p>
          <a routerLink="/settings">Back up your notebook →</a>
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
    .team-stamp {
      border: 2px solid var(--green);
      padding: 18px 12px;
      transform: rotate(-5deg);
      font-weight: 900;
      letter-spacing: 2px;
      max-width: 150px;
      overflow-wrap: anywhere;
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
      .team-stamp {
        font-size: 11px;
        max-width: 94px;
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
  name = '';
  shortName = '';
  season = String(new Date().getFullYear());
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
}
