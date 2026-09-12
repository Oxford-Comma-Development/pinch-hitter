# Pinch Hitter — Coach's Field Manual & User Guide

Welcome to **Pinch Hitter**, your personal baseball and softball coaching notebook and batting-practice spray chart.

Pinch Hitter was designed specifically for the coach standing behind the batting cage or catcher's box: **phone in one hand, thumb on the screen, and your attention where it belongs—on your hitter.**

---

## Table of Contents

1. [Philosophy & Quick Start](#1-philosophy--quick-start)
2. [Team & Season Setup](#2-team--season-setup)
3. [Building Your Roster](#3-building-your-roster)
4. [Running Batting Practice](#4-running-batting-practice)
   - [Starting a Practice](#starting-a-practice)
   - [Tapping the Field & Capturing Locations](#tapping-the-field--capturing-locations)
   - [Swings & Misses (The Whiff Scale)](#swings--misses-the-whiff-scale)
   - [Hit Power & Contact Quality (1–5 Scale)](#hit-power--contact-quality-15-scale)
   - [Trajectories & Outcomes](#trajectories--outcomes)
   - [Pitcher Handedness & Switch Hitters](#pitcher-handedness--switch-hitters)
   - [Managing the Queue on the Fly](#managing-the-queue-on-the-fly)
   - [Hands-Free Voice Selection](#hands-free-voice-selection)
   - [Left-Handed Dugout Mode](#left-handed-dugout-mode)
   - [Practice Options & Mid-Session Toggles](#practice-options--mid-session-toggles)
   - [One-Tap Undo](#one-tap-undo)
5. [Reports, Spray Charts & Analytics](#5-reports-spray-charts--analytics)
   - [Interactive Spray Charts](#interactive-spray-charts)
   - [Contact Density (Heatmaps)](#contact-density-heatmaps)
   - [Directional Tendencies (Pull / Center / Oppo)](#directional-tendencies-pull--center--oppo)
   - [Pitcher Matchup Splits](#pitcher-matchup-splits)
   - [Progress Tracking: 14-Day vs. Season](#progress-tracking-14-day-vs-season)
   - [Observation History & Bulk Edits](#observation-history--bulk-edits)
6. [Data Ownership, Backups & Sharing](#6-data-ownership-backups--sharing)
   - [JSON Backups](#json-backups)
   - [CSV Spreadsheet Export](#csv-spreadsheet-export)
   - [Print & PDF Generation](#print--pdf-generation)
   - [Installing for 100% Offline Use](#installing-for-100-offline-use)
7. [Accessibility, Display & Field Ergonomics](#7-accessibility-display--field-ergonomics)
   - [Color-Blind Friendly Palette (Okabe-Ito)](#color-blind-friendly-palette-okabe-ito)
   - [Multi-Shape Marker Glyphs](#multi-shape-marker-glyphs)
   - [High-Contrast Slate Field for Direct Sunlight](#high-contrast-slate-field-for-direct-sunlight)
   - [One-Handed Mobile Ergonomics](#one-handed-mobile-ergonomics)

---

## 1. Philosophy & Quick Start

### Your Notebook Belongs to You

Most modern sports apps require user logins, continuous internet connectivity, and monthly server synchronization that locks away your data. Pinch Hitter takes a fundamentally different approach:

- **No account required**: You never sign up, log in, or remember passwords.
- **On-device storage**: All teams, rosters, spray charts, and notes are saved directly to your device's browser memory (IndexedDB).
- **Offline-ready**: Works in concrete dugouts, remote rural ballparks, and airplane mode.
- **Zero data hostage**: You can export your full notebook as a universal JSON backup or CSV spreadsheet whenever you choose.

### The 60-Second Setup

1. **Create your team**: Give your team a name and season label.
2. **Add hitters**: Paste a list of names or add them one by one.
3. **Tap "Start Practice"**: Your players appear in batting order.
4. **Watch & Tap**: When the ball is hit, tap where it lands on the field. Tap **Next batter** when their round is done.

---

## 2. Team & Season Setup

When you first open Pinch Hitter, you will be prompted to create your team:

- **Team Name**: The display name of your club (e.g., _Westfield Wildcats_).
- **Short Name**: An optional short abbreviation (e.g., _WILDCATS_) used on compact screens.
- **Season**: A flexible text label (e.g., _Spring 2026_, _Fall Ball 14U_, or _Summer Showcase_).
- **Team Emblem**: You can upload a team logo or picture from your camera roll. If you don't have one, Pinch Hitter automatically creates an elegant monogram crest with your team's initials.

> **Coaching Tip:** You can manage multiple teams (e.g., your High School Varsity squad and your weekend Travel team) in **Settings → Active Team**. Each team maintains its own separate roster, sessions, notes, and historical reports.

---

## 3. Building Your Roster

Navigate to **Roster** from the navigation bar.

### Adding Players Manually

Tap **+ Add player** to enter:

- **Player Name**: Full name or first name/last initial.
- **Jersey Number**: Numbers up to two digits (including `00`).
- **Batting Hand**: Right (`R`), Left (`L`), or Switch (`S`).
- **Throwing Hand**: Right (`R`), Left (`L`), or Switch (`S`).
- **Primary Positions**: Check all positions they play (e.g., `SS`, `2B`, `OF`).
- **Grade / Class**: Optional school or age grade (e.g., `Sophomore`, `12U`).
- **Player Notes**: Personal development notes, swing mechanics cues, or focus areas.

### Quick Roster Import

If you already have your lineup in a text message, email, or spreadsheet:

1. **Paste a List**: Under **Quick Roster Setup**, paste names and jersey numbers into the text box (one player per line):
   ```text
   Marcus Williams, 12
   Tyler Davis, 7
   James Chen, 24
   Sam Ramirez, 3
   ```
   Tap **Preview players** and confirm to import instantly.
2. **Import CSV**: Tap **Choose CSV** to upload a spreadsheet containing columns like `name`, `jerseyNumber`, `bats`, `throws`, and `positions`.

### Setting Default Practice Order

Players hit in the order displayed on your roster. Use the **↑** and **↓** arrows to arrange your standard lineup order. This order will automatically pre-populate every batting practice session.

### Archiving Players

When a player graduates, changes teams, or suffers a season-ending injury, edit their profile and uncheck **Active**. Archived players are hidden from daily batting practice lineups, but **all of their historical batting contacts, spray charts, and notes remain completely intact**.

---

## 4. Running Batting Practice

### Starting a Practice

Tap **Start Practice** from the Home dashboard or navigation menu.

1. **Who's Hitting Today?**: Uncheck any players who are absent or sitting out. Use the arrows to tweak today's batting order if needed.
2. **Choose Hitter Rotation**:
   - **Manual Advance**: The current hitter stays in the box until you explicitly tap **Next batter**.
   - **Auto Rotation (1, 3, 5, or Custom contacts)**: The app automatically advances the hitter after recording the specified number of contacts.
3. **Optional Details**: Add a practice title (e.g., _Curveball BP_, _Simulated Game_) or field location.
4. Tap **Start practice →**.

---

### Tapping the Field & Capturing Locations

The field representation is an accurate, responsive baseball diamond.

- **Touch where the ball lands**: As soon as contact is made, tap the spot on the diamond or outfield grass.
- **Foul balls & Bunts**: Tap behind the foul lines or in front of home plate.
- **Immediate Confirmation**: A confirmation badge appears with a checkmark, and your turn count updates instantaneously.

---

### Swings & Misses (The Whiff Scale)

Batting practice isn't just about balls in play; knowing when a hitter is swinging through pitches is crucial for coaching pitch recognition and timing.

- Tap **0 Miss** at the left of the hit power scale.
- A whiff is automatically recorded at home plate without requiring you to tap the field.
- Reports isolate swing-and-miss events so you can analyze contact rate alongside spray distributions.

---

### Hit Power & Contact Quality (0–6 Scale)

Right below the field, Pinch Hitter gives you an optional contact quality scale:

| Rating | Short Label   | Description                                                           |
| :----: | :------------ | :-------------------------------------------------------------------- |
| **0**  | **0 Miss**    | Swing and miss / whiff at the plate.                                  |
| **1**  | **1 Weak**    | Weak contact, jammed, off the end of the bat, dribbler.               |
| **2**  | **2 Soft**    | Routine contact, caught easily by an infielder or shallow outfielder. |
| **3**  | **3 Med**     | Medium contact, driven into gaps or through infield holes.            |
| **4**  | **4 Hard**    | Hard-hit ball; sharp exit velocity, deep outfield drive.              |
| **5**  | **5 Crushed** | Smoked / barrel contact, warning-track or gap power.                  |
| **6**  | **6 Plákata** | Absolute peak contact, no-doubt home run power.                       |

> **Coaching Tip:** Adding hit quality is completely optional! If you have a fast pitcher or machine running, simply tapping the landing location is enough. You can tap a rating afterward whenever you have a split-second between pitches.

---

### Trajectories & Outcomes

For coaches who want deeper classifications:

- **Trajectory buttons**: Fly ball, Line drive, Ground ball, Pop up, Bunt.
- **Outcome buttons**: Out, Single, Double, Triple, Home Run, Error, Foul, Sac.

---

### Pitcher Handedness & Switch Hitters

- **Pitcher Toggle (`RHP` / `LHP`)**: Located right next to the hitter's name. Switch it whenever you change batting-practice pitchers or machines. This Handedness is saved per contact, enabling powerful split reports.
- **Switch Hitters**: For players marked as switch hitters (`S`), a **Left / Right** toggle appears above the field so you can indicate which batter's box they are standing in.

---

### Managing the Queue on the Fly

The batting queue strip sits directly above the field:

- **On Deck & In the Hole**: Displays the next five hitters up.
- **Drag to Reorder**: Touch and hold the drag handle (`⠿`) on any upcoming hitter chip to slide them forward or backward in the queue.
- **Lineup Sheet (`Lineup ↗`)**: Tap to open the full queue:
  - **Hit Now**: Jump any player directly into the batter's box right now.
  - **Defer**: Push a player back one spot if they are still retrieving their helmet or bat.
  - **Sit Out**: Remove a player from the remaining rounds without deleting them from the team.

---

### Hands-Free Voice Selection

If you're throwing batting practice or tracking while standing behind a safety screen:

1. Tap the **Microphone** icon in the queue strip.
2. Say the player's name or number (e.g., _"Marcus"_, _"Chen"_, or _"Number 24"_).
3. Pinch Hitter recognizes the hitter and automatically rotates them into the batter's box.

### Left-Handed Dugout Mode

In live batting practice, coaches rarely operate phones with two hands. One hand holds a fungo bat, a bucket of balls, or grips the protective screen. When holding a phone in your **left hand**, reaching across to the bottom-right corner for the primary "Next batter" button causes awkward thumb strain and accidental taps on "Undo".

- **Left-Handed Mode** mirrors the bottom action bar:
  - Standard (Right Hand): `[ ↶ Undo last ] [ Skip ] [ Next batter → ]`
  - Left-Handed: `[ ← Next batter ] [ Skip ] [ Undo last ↷ ]`
- The large `Next batter` button is placed directly under your left thumb.
- Pitcher toggle (`RHP / LHP`) and queue management chips shift to the left rail for immediate one-thumb reach.
- Enable it in **Settings → Practice defaults**, or toggle it instantly on the field in **`⚙ Practice options`**.

---

### Practice Options & Mid-Session Toggles

Tap the **Gear (`⚙`)** icon in the practice toolbar at any time to adjust live session settings without stopping practice:

- **Hitter Rotation**: Switch between manual advance and automatic rotation after 1, 3, 5, or custom recorded contacts.
- **Left-Handed Dugout Mode**: Switch left/right hand reach on the fly.
- **High-Contrast Sunlight Field**: Instantly switch the diamond to dark slate if outdoor sun glare makes the grass difficult to see.
- **Color-Blind Friendly Palette**: Toggle the Okabe-Ito barrier-free color scheme.

---

### One-Tap Undo

Coaching moves fast. If you tap the wrong spot or accidentally hit "Next batter":

- Tap **↶ Undo last**.
- Pinch Hitter removes the misrecorded contact, restores the previous hitter to the box, and rewinds your turn counter and sequence smoothly. The app maintains a 100-step reversible undo history for every practice.

---

## 5. Reports, Spray Charts & Analytics

Navigate to **Reports** to explore your team and player data.

### Interactive Spray Charts

- **Filter by Player or Whole Team**: Switch between the entire team spray chart or isolate an individual hitter.
- **Interactive Marks**: Tap any contact dot on the field to inspect the exact date, time, pitcher hand, contact type, hit strength rating, and coaching notes.
- **Color-Coding**: Color dots by:
  - **Contact Type**: Yellow for line drives, blue for fly balls, brown for ground balls, purple for pop-ups, orange for bunts.
  - **Hit Result**: Green for hits, red for outs, gray for fouls/errors.
  - **Hard Hit Rating**: Distinct heat colors ranging from 1 (Soft) to 5 (Crushed).

---

### Contact Density (Heatmaps)

Toggle the view from **Spray** to **Heat**.
Pinch Hitter calculates an in-memory density grid across the diamond and outfield. Darker, glowing zones highlight where the hitter consistently sprays the ball, making it easy to identify tendencies and defensive positioning holes at a glance.

---

### Directional Tendencies (Pull / Center / Oppo)

The **Directional Tendencies** card calculates exact hitting angles:

- **Center**: Contact within a 30-degree cone ($\pm 15^\circ$) through center field.
- **Pull Side**: Left field for right-handed hitters; Right field for left-handed hitters.
- **Opposite Field**: Right field for right-handed hitters; Left field for left-handed hitters.

Percentages are calculated based on known batted balls, giving you actionable data for swing adjustments (e.g., _"Marcus is pulling 68% of pitches—let's work on letting the ball travel deeper"_).

---

### Pitcher Matchup Splits

Compare how your hitters perform against Right-Handed Pitchers (`vs. RHP`) versus Left-Handed Pitchers (`vs. LHP`). Tap either split button to instantly filter the entire spray chart and analytics breakdown to that matchup.

---

### Progress Tracking: 14-Day vs. Season

Are your coaching adjustments working?
The **Recent vs. Season** comparison table stacks the hitter's last 14 days of practice directly against their full-season baseline. Look for increases in line-drive percentage and hard-hit rate to validate mechanical improvements.

---

### Observation History & Bulk Edits

Switch the report view to **History** to see a chronological log of every recorded contact:

- **Edit Single Hit**: Adjust the landing coordinate, reassign contact quality, or add a note.
- **Bulk Move**: Select multiple contacts and move them to another hitter (useful if you accidentally recorded another player's round under the wrong name).
- **Bulk Delete**: Remove bad test data or unwanted contacts with one confirmation.

---

## 6. Data Ownership, Backups & Sharing

### JSON Backups ("Take Your Notebook With You")

Because Pinch Hitter does not store your players' data on a corporate cloud server, making regular backups ensures you never lose a season of hard work:

- Go to **Settings → Take your notebook with you**.
- Tap **Save or share notebook** (or **Download JSON backup**).
- Save the file into your **iCloud Drive**, **Google Drive**, **Dropbox**, or send it to yourself via AirDrop or email.
- **Restoring on Another Device**: Open Pinch Hitter on an iPad or new phone, tap **Choose notebook backup (.json)**, and all your teams, players, practices, notes, and spray charts merge seamlessly.

### CSV Spreadsheet Export

Need to run advanced statistics in Microsoft Excel, Google Sheets, or Python?

- Tap **Download CSV** from any report or settings page.
- Export includes timestamp, player name, jersey number, normalized coordinates (`fieldX`, `fieldY`), pitcher hand, batter side, trajectory, outcome, power rating, and coach notes. All text cells are formula-escaped for safety.

### Print & PDF Generation

Want to hand a spray chart to a player or send it home to parents?

- Tap **Print / PDF** on any player or team report.
- The interface automatically formats a clean, high-contrast, professional page layout hiding all navigation buttons.
- Use your browser or device's print dialog to print hard copies or save directly as a PDF.

### Installing for 100% Offline Use

Pinch Hitter is a Progressive Web App (PWA):

- **iPhone / iPad (Safari)**: Tap the **Share** button at the bottom of Safari, scroll down, and tap **Add to Home Screen**.
- **Android (Chrome)**: Tap the three-dot menu and select **Install app** or **Add to Home screen**.
- **Mac / Windows / Chromebook**: Click the install icon in your browser address bar or use **Settings → Install Coach Helper**.

Once installed, Pinch Hitter launches in full screen like a native app and works anywhere you coach, with or without Wi-Fi or cellular service.

---

## 7. Accessibility, Display & Field Ergonomics

Baseball and softball happen in bright sunlight, dusty dugouts, and high-pressure practice rounds. Pinch Hitter includes built-in visual accessibility and ergonomic controls designed to keep charts legible and recording fast under any field conditions.

### Color-Blind Friendly Palette (Okabe-Ito)

Baseball diagrams traditionally render as green turf, and contact outcomes are frequently marked in red (for outs) and green (for hits). For coaches with red-green color vision deficiency (deuteranopia or protanopia), red markers on green grass can blend into muddy brown.

Pinch Hitter offers an accessible color palette based on the scientifically validated Okabe-Ito barrier-free color spectrum:

- **Line Drives & Singles**: Bright, high-visibility Yellow (`#F0E442`).
- **Ground Balls & Doubles**: Distinct Orange (`#E69F00`).
- **Fly Balls & Triples**: Reddish Purple (`#CC79A7`).
- **Pop-Ups**: Sky Blue (`#56B4E9`).
- **Bunts**: Vivid Vermilion (`#D55E00`).
- **Outs & Whiffs**: Dark Charcoal (`#2C3437`) and deep black borders for high contrast.
- **CVD-Friendly Heatmaps**: Contact density transitions smoothly from Deep Blue (`#0072B2`) through Sky Blue (`#56B4E9`) to Bright Yellow (`#F0E442`), avoiding ambiguous red-green gradients.

You can enable this in **Settings → Visual Accessibility & Display** or switch it live during practice via the **Practice Options (`⚙`)** sheet.

---

### Multi-Shape Marker Glyphs

In harsh outdoor light or for coaches with severe vision differences, color alone is often not enough. Pinch Hitter supports redundant visual encoding (WCAG 1.4.1) through distinct geometric shapes:

- **Line Drives**: Diamond (`◆`)
- **Fly Balls**: Upward Triangle (`▲`)
- **Ground Balls**: Standard Circle (`●`)
- **Pop-Ups**: Inverted Triangle (`▼`)
- **Bunts**: High-contrast Cross (`+`)
- **Outs & Whiffs**: Square (`■`) or circled cross (`⊗`)
- **Home Runs**: 5-Point Star (`★`)

When shape markers are enabled, the spray chart legend, contact detail inspection cards, and the interactive SVG diamond all synchronize to show these geometric symbols. You can instantly distinguish contact trajectories even on black-and-white printouts or low-brightness screens.

---

### High-Contrast Slate Field for Direct Sunlight

Midday summer doubleheaders bring intense solar glare that can wash out phone screens, making green grass backgrounds hard to read.

The **High-Contrast Slate** theme replaces the green turf diamond with an obsidian slate field (`#0f172a`):

- **6px Pure White Foul Lines**: Bold chalk lines remain razor-sharp even in full direct sunlight.
- **Luminous White Bases**: First, second, and third bases and home plate render in high-contrast solid white with dark borders.
- **Bold 700-Weight Typography**: Field yardage and position labels stand out clearly at arm's length.
- **Print Optimization**: When you print or save a report to PDF, the app automatically converts the slate field into a clean, crisp line-art blueprint with white paper background, saving printer toner while preserving contrast.

---

### One-Handed Mobile Ergonomics

Coaches rarely have two hands free during batting practice. You're typically holding a bat, gripping a bucket of balls, or steadying yourself against the protective L-screen while operating your phone with one thumb.

Pinch Hitter's mobile layout is engineered for single-thumb reach:

- **Right-Handed & Left-Handed Modes**: The bottom action bar can be flipped in seconds so your primary action button—**Next batter**—is positioned right under your thumb with extra touch padding (`flex: 1.5`), preventing thumb strain across large modern screens.
- **Protected Secondary Actions**: The **Undo** button is positioned safely on the opposite corner to eliminate accidental taps when reaching for rotation controls.
- **Single-Thumb Toggles**: Pitcher handedness (`RHP / LHP`), switch-hitter sides, and the lineup sheet button all adapt to your active hand rail.
- **Mid-Session Practice Options**: Tap the gear (`⚙`) icon at the top of the practice screen to switch handedness, field theme, or rotation counts in two taps without losing your active round or queue state.
