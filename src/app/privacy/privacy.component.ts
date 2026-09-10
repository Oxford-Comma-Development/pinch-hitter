import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-privacy',
  imports: [RouterLink],
  template: `
    <div class="page privacy-page">
      <div class="privacy-header">
        <div>
          <p class="eyebrow">TRANSPARENCY & DATA HYGIENE</p>
          <h1>Privacy Policy.</h1>
          <p class="muted">
            Your field. Your notebook. Your data.<br />
            Last updated: September 2026
          </p>
        </div>
        <div class="header-actions">
          <a routerLink="/settings" class="button">← Back to Settings</a>
        </div>
      </div>

      <div class="highlights-banner">
        <div class="highlight-item">
          <span class="highlight-icon" aria-hidden="true">🔒</span>
          <strong>100% On-Device</strong>
          <span>All team and player data stays in your browser's local storage.</span>
        </div>
        <div class="highlight-item">
          <span class="highlight-icon" aria-hidden="true">🚫</span>
          <strong>Zero Tracking</strong>
          <span>No Google Analytics, no tracking pixels, and no advertising SDKs.</span>
        </div>
        <div class="highlight-item">
          <span class="highlight-icon" aria-hidden="true">👤</span>
          <strong>No Account Needed</strong>
          <span>No email, password, or sign-up required. Start coaching immediately.</span>
        </div>
        <div class="highlight-item">
          <span class="highlight-icon" aria-hidden="true">💾</span>
          <strong>Full Data Ownership</strong>
          <span>Export your complete notebook anytime to JSON or CSV.</span>
        </div>
      </div>

      <div class="policy-grid">
        <section class="card">
          <p class="eyebrow">CORE PHILOSOPHY</p>
          <h2>The Coach's Personal Notebook</h2>
          <p>
            Pinch Hitter is designed to be the modern digital equivalent of a coach's pocket
            notebook. When you write notes in a physical scorebook or lineup card in the dugout,
            that information belongs to you and stays with you. Pinch Hitter operates under the
            exact same principle.
          </p>
          <p>
            We believe coaches should never have to surrender player data or personal details just
            to run a productive batting practice.
          </p>
        </section>

        <section class="card">
          <p class="eyebrow">DATA STORAGE</p>
          <h2>Where Your Data Lives</h2>
          <p>
            All information entered into Pinch Hitter—including team names, rosters, player names,
            uniform numbers, batting stances, practice sessions, pitch and contact coordinates,
            spray charts, and coaching observations—is stored
            <strong>exclusively on your local device</strong>
            using standard web browser storage (IndexedDB).
          </p>
          <p>
            Pinch Hitter maintains no central database or remote servers that store coach or player
            records. If you close the app, your data remains safely in your device's browser cache.
          </p>
        </section>

        <section class="card">
          <p class="eyebrow">TELEMETRY & TRACKING</p>
          <h2>No Analytics, Tracking, or Advertising</h2>
          <ul class="policy-list">
            <li>
              <strong>No Google Analytics:</strong> We do not embed Google Analytics or any
              third-party telemetry tools.
            </li>
            <li>
              <strong>No Tracking Scripts or Cookies:</strong> We do not track your behavior across
              the web or profile your coaching habits.
            </li>
            <li>
              <strong>No Ads or Data Monetization:</strong> We do not display ads or sell, share, or
              broker your team's information to anyone.
            </li>
          </ul>
        </section>

        <section class="card">
          <p class="eyebrow">DEVICE PERMISSIONS</p>
          <h2>Microphone & Voice Input</h2>
          <p>
            During batting practice, coaches may optionally use voice input to log contacts or
            dictate quick coaching notes hands-free.
          </p>
          <p>
            Speech recognition is powered directly by your browser or operating system's built-in
            Web Speech API. Pinch Hitter
            <strong>does not record, store, or transmit raw audio files</strong>
            to any external server. Microphone access is requested only when you tap the voice
            button, and you can revoke microphone permissions in your browser or device settings at
            any time.
          </p>
        </section>

        <section class="card">
          <p class="eyebrow">DATA PORTABILITY</p>
          <h2>Export, Backups, and Transfers</h2>
          <p>
            Your notebook data only leaves your device when you explicitly choose to export or share
            it:
          </p>
          <ul class="policy-list">
            <li>
              <strong>JSON Backup:</strong> You can download or share a complete JSON archive of
              your notebook from Settings. You can restore this file on another phone, tablet, or
              laptop.
            </li>
            <li>
              <strong>CSV Export:</strong> You can export recorded batting contacts and spray-chart
              coordinates to a CSV spreadsheet for custom analysis.
            </li>
            <li>
              <strong>Device Share Sheet:</strong> On supported devices (iOS, Android, macOS), you
              can save your backup directly to iCloud Drive, Google Drive, or send it via AirDrop.
            </li>
          </ul>
        </section>

        <section class="card">
          <p class="eyebrow">CONTROL & DELETION</p>
          <h2>How to Delete Your Data</h2>
          <p>You have complete control over data retention:</p>
          <ul class="policy-list">
            <li>
              <strong>Individual Teams or Players:</strong> You can edit or delete teams and archive
              players directly within the app.
            </li>
            <li>
              <strong>Complete Purge:</strong> In the <em>Settings</em> tab under
              <em>Clear this notebook</em>, typing <code>DELETE</code> immediately and permanently
              removes all teams, players, practices, contacts, and notes from your device's browser
              storage.
            </li>
            <li>
              <strong>Browser Clearing:</strong> Clearing website data or browser storage for Pinch
              Hitter removes all stored records instantly.
            </li>
          </ul>
        </section>

        <section class="card">
          <p class="eyebrow">NETWORK & UPDATES</p>
          <h2>Offline Capability & Network Usage</h2>
          <p>
            Pinch Hitter is an offline-ready Progressive Web App (PWA). Once downloaded to your
            browser or home screen, the entire app functions without an active internet connection.
          </p>
          <p>
            Network access is used solely to fetch static application updates (via a service worker)
            and verify that you are running the latest version of the application code.
          </p>
        </section>

        <section class="card">
          <p class="eyebrow">QUESTIONS & CONTACT</p>
          <h2>Questions or Feedback</h2>
          <p>
            If you have questions about this privacy policy or Pinch Hitter's data practices, you
            can review our open documentation or reach out via our project repository:
          </p>
          <p class="contact-links">
            <a
              href="https://github.com/Oxford-Comma-Development/pinch-hitter"
              target="_blank"
              rel="noopener noreferrer"
              class="button secondary"
            >
              Pinch Hitter on GitHub ↗
            </a>
          </p>
        </section>
      </div>

      <div class="privacy-footer">
        <a routerLink="/settings" class="button primary">Return to Settings</a>
        <a routerLink="/" class="button">Home</a>
      </div>
    </div>
  `,
  styles: [
    `
      .privacy-page {
        max-width: 960px;
        margin: auto;
      }
      .privacy-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        margin-bottom: 28px;
        flex-wrap: wrap;
      }
      .header-actions {
        padding-top: 4px;
      }
      .highlights-banner {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 16px;
        margin-bottom: 32px;
      }
      .highlight-item {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 18px 16px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        font-size: 13px;
        line-height: 1.4;
      }
      .highlight-item strong {
        color: var(--green);
        font-size: 15px;
      }
      .highlight-item span {
        color: var(--muted);
      }
      .highlight-icon {
        font-size: 24px;
        line-height: 1;
        margin-bottom: 4px;
      }
      .policy-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 24px;
      }
      .policy-list {
        margin: 0;
        padding-left: 20px;
        display: grid;
        gap: 10px;
        line-height: 1.55;
      }
      .policy-list strong {
        color: var(--ink);
      }
      .contact-links {
        margin-top: 16px;
      }
      .privacy-footer {
        margin-top: 40px;
        display: flex;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }
      @media (max-width: 600px) {
        .privacy-header {
          flex-direction: column;
        }
        .header-actions {
          width: 100%;
        }
        .header-actions .button {
          width: 100%;
        }
        .privacy-footer .button {
          width: 100%;
        }
      }
    `,
  ],
})
export class PrivacyComponent {}
