# Baseball Coach Helper data format

Coach data lives in IndexedDB on the device. No account or hosted database is involved. A JSON backup contains the complete portable domain model; CSV is a flat analysis export. Keep JSON backups for transfer between devices or recovery after a browser clears site data.

## Versions and migrations

There are three independent version numbers:

| Version                           | Current | Purpose                               |
| --------------------------------- | ------- | ------------------------------------- |
| IndexedDB database version        | 2       | Browser storage migrations            |
| JSON / observation schema version | 1       | Portable entity structure             |
| Coordinate system version         | 1       | Meaning of normalized field positions |

`CoachRepository.open()` applies migrations using `oldVersion` inside IndexedDB's upgrade transaction. Database version 1 creates the six domain stores and indexes; version 2 adds the metadata revision store. Migrations preserve existing records. Future migrations should be appended, never implemented by deleting a populated database. A database version change does not automatically require a JSON or coordinate format change.

JSON import currently accepts schema version 1. Unsupported versions, including missing versions, are rejected before any writes. Future import migrations should explicitly transform an older schema into the current shape and run the same validation. Never reinterpret an old coordinate version as a new one.

## IndexedDB schema

Database name: `baseball-coach-helper`. Every object store has key path `id`.

| Store      | Records                                                         | Indexes                                                                        |
| ---------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `teams`    | Team identity, short name, season and notes                     | Primary ID                                                                     |
| `players`  | Roster details, active status and default order                 | `teamId`                                                                       |
| `sessions` | Practice metadata, participants, queue and resumable turn state | `teamId`                                                                       |
| `events`   | Individual recorded batted-ball observations                    | `teamId`, `playerId`, `sessionId`, `timestamp`, unique `[sessionId, sequence]` |
| `notes`    | Timestamped notes with team/player/session/event scope          | `teamId`, `playerId`, `sessionId`                                              |
| `settings` | Singleton `id: "preferences"`                                   | Primary ID                                                                     |
| `metadata` | Internal `id: "revision"`, random revision value                | Primary ID                                                                     |

The revision record is an implementation detail and is excluded from backups. Team, player, session, event and note IDs are stable UUIDs generated with `crypto.randomUUID()`. Import preserves supplied nonempty stable IDs. Names and jersey numbers are display values, never relational keys.

The store serializes writes within a window. Native Web Locks serialize the read/modify/write operation across windows when available. A small revision check detects changes from another window; a full read is only needed after its revision changes. Every write also compares the expected revision inside its IndexedDB transaction; a stale writer aborts and retries from current data up to twice. This protects browsers without Web Locks from silently overwriting a newer queue. Core capture writes the new event, its session queue/turn state, and database revision in **one read/write transaction**. Signals update only after transaction completion. Failed writes retain the previous visible and persisted state and show an error. A contact is never acknowledged before it is saved.

The UI loads domain records into Angular signals once and derives reports from those arrays. IndexedDB indexes support a future move to ranged queries without changing the model. Filtering and summary calculations are linear in the selected observations; density rendering uses a bounded grid. The deliberate ceiling is a season's data fitting in browser memory, with an import limit of 250,000 records per entity collection. For substantially larger archives, use indexed date/team queries and paginated history rather than loading every record.

## Entities and relationships

All domain entities have `id`, `createdAt`, and `updatedAt`. Dates are ISO 8601 timestamps normalized to UTC on import. The interfaces in `src/app/data/models.ts` are the exact schema.

- **Team:** `name`, `shortName`, `season`, `notes`. Seasons remain text so coaches can use labels such as `Spring 2026`.
- **Player:** `teamId`, `name`, `jerseyNumber`, `grade`, `bats`, `throws`, `positions`, `notes`, `active`, `order`. Jersey numbers remain strings, preserving values such as `00`. `bats` and `throws` are `L`, `R`, or `S`; positions are strings. Archiving does not delete historical events or session participation.
- **PracticeSession:** `teamId`, `startedAt`, nullable `endedAt`, `title`, `location`, `notes`, `participantIds`, `queue`, `currentTurn`, `turnContacts`, `nextSequence`, nullable `rotationCount`, `pitcherHand`, and `undoStack`. Participants include players temporarily removed from the active queue. The queue has no duplicates; its first ID is current. Empty queues are valid while all participants are temporarily removed.
- **BallEvent:** `schemaVersion`, `teamId`, `playerId`, `sessionId`, `timestamp`, `sequence`, `turnSequence`, `contactSequence`, `fieldX`, `fieldY`, `coordinateSystemVersion`, `pitcherHand`, `batterSide`, nullable `contactType`, nullable `result`, `notes`, `playerName`, `jerseyNumber`, and common entity fields. `playerName` and `jerseyNumber` are event-time snapshots; roster edits do not rewrite historical identity.
- **CoachNote:** `teamId`, nullable `playerId`, `sessionId`, `eventId`, `timestamp`, `text`, and common entity fields. Event notes inherit player and session scope. References must belong to the same team; an event-associated note must match its event's player/session.
- **AppSettings:** singleton `id`, nullable `activeTeamId`, `defaultPitcherHand`, nullable `rotationCount`, `haptics`, `updatedAt`.

Every event's player and session must exist and belong to the event's team. The player must occur in that session's participant list. An event can have both inline `notes` and multiple separately timestamped notes. CSV combines these into its notes cell; JSON preserves the distinction.

### Turn and undo semantics

Sequences start at 1. `sequence` is unique within a practice. It increases across hitter changes and is not reused after Undo or deletion, so gaps are normal. `turnSequence` identifies the current turn; `contactSequence` counts recorded contacts in that turn. These are recorded contacts, not pitches, swings or plate appearances.

`rotationCount: null` means manual advancement. Positive integers 1 through 100 enable automatic advancement. Advancing rotates the first queued player to the back, increments `currentTurn`, and resets `turnContacts`. Pitcher handedness persists independently of hitter changes.

Each capture stores an undo entry containing `eventId` and `before` / `after` snapshots of `queue`, `currentTurn`, `turnContacts`, and `nextSequence`. The latest 100 captures remain undoable; older observations remain editable in history. Undo deletes the event and its associated notes in the same transaction as restoring session state. Automatic advancement is reversed when the queue still matches the post-capture state. Deliberate queue changes made after capture are retained.

## Coordinate system version 1

The field is a square SVG coordinate surface with a conceptual viewBox of `0 0 1000 1000`:

- Origin `(0, 0)` is the **top left** of the square.
- X increases rightward; Y increases downward.
- `fieldX = svgX / 1000`; `fieldY = svgY / 1000`.
- Each value must be finite and in `[0, 1]`, including the boundaries.
- Home plate is centered at `(0.5, 0.88)`.
- Center field runs upward from home toward `(0.5, 0.08)`.
- Left field appears on the viewer's left, looking outward from behind home plate.
- Foul territory and locations behind home remain recordable. Coordinates describe the observed location, not a distance in feet or meters.

The capture conversion accounts for square SVG letterboxing when the surrounding viewport is not square. Resizing, landscape orientation, printing and import must only change the display transform. Never rewrite stored coordinates to fit a new screen or heatmap.

Directional angle is derived as `atan2(fieldX - 0.5, 0.88 - fieldY)`. The center zone spans ±15 degrees. For a right-handed hitter, a negative angle is pull side; for a left-handed hitter, a positive angle is pull side. Missing batter side and the exact home-plate location produce an unknown direction. For switch hitters, the coach's event-time side is used; a roster `S` alone never establishes pull/opposite direction. These categories are coaching heuristics, not measured launch angles or official scoring.

## Canonical JSON

Export produces UTF-8 JSON with this top-level structure:

```json
{
  "schemaVersion": 1,
  "application": "Baseball Coach Helper",
  "applicationVersion": "1.0.0",
  "exportedAt": "2026-05-04T18:30:00.000Z",
  "teams": [],
  "players": [],
  "sessions": [],
  "events": [],
  "notes": [],
  "settings": {
    "id": "preferences",
    "activeTeamId": null,
    "defaultPitcherHand": "R",
    "rotationCount": null,
    "haptics": true,
    "updatedAt": "2026-05-04T18:30:00.000Z"
  }
}
```

The export includes all teams, archived players, completed/active sessions, events, notes and settings. Empty strings mean an optional text value was not entered. Nullable classification or handedness fields use JSON `null` rather than an invented category. Accepted contact types are `dribbler`, `ground-ball`, `line-drive`, `pop-up`, `fly-ball`; results are `out`, `single`, `double`, `triple`, `home-run`.

### Import and merge

Import first parses and validates the complete file: application/schema identity, primitive types, timestamps, coordinates, enums, duplicate IDs, queue consistency, and relational integrity. The preview shows counts and the number of matching local IDs. Applying the preview validates it again and validates the resulting merged graph before committing everything atomically.

Merge keeps local records absent from the file. For matching entity IDs, the newer `updatedAt` wins; equal timestamps retain the local record. Existing local preferences are retained; an empty installation takes the imported preferences and active team.

If two coaches continue copies of the same practice independently, distinct event IDs are preserved. Incoming events with a colliding practice sequence are appended to unused sequence numbers. Their IDs, timestamps, locations and observation context remain unchanged. `nextSequence` is reconciled to exceed every surviving event sequence. Shared-practice undo history is cleared because a merged queue's capture history is no longer safely reversible; each observation remains editable/deletable in history. Participation expands to include every merged event's player. These rules make importing the same backup again idempotent for event identity.

Multiple active practices are retained rather than silently completed. The most recently started active practice for a team is offered on Home. Finish the current practice before explicitly resuming an older one. An import warning calls out multiple active sessions present in a file.

Merge does not propagate deletion tombstones; importing an older backup can restore an observation that was deleted locally. Use a deliberate local-data reset before importing when a complete restore into a clean installation is desired. A merge never implements destructive replacement.

## Event CSV

CSV uses UTF-8 text, comma separators, CRLF rows, and RFC 4180 quoted cells. Quotes inside a cell are doubled; notes may contain newlines. Unknown/null values become empty cells. The first row contains stable column names:

```text
event_id,player_id,player_name,jersey_number,team_id,team_name,team_season,session_id,session_date,event_timestamp,pitcher_hand,batter_side,contact_type,result,field_x,field_y,coordinate_system_version,event_sequence,turn_sequence,contact_sequence,notes,created_at,updated_at
```

`session_date` is the full practice-start ISO timestamp. `event_timestamp`, `created_at` and `updated_at` are ISO timestamps. Coordinates are the original normalized numbers with no rounding. Classification values use the JSON enum codes. `notes` includes inline observation notes followed by timestamped event-associated notes.

Text beginning with spreadsheet formula characters (`=`, `+`, `-`, `@`, including after whitespace) is prefixed with an apostrophe to prevent interpretation as an Excel/Sheets formula. JSON retains the exact original text. CSV is for analysis; use JSON for a lossless restore. Report CSV export may contain only the filtered player, session or team observations; Settings exports all local observations.

## Roster CSV import

Use headers `name,jersey_number,bats,throws,grade,positions` in any column order. Name aliases `player`, `player_name`, `display_name` and jersey aliases `number`, `jersey`, `#` are accepted. Case, spaces, underscores and hyphens in headers are ignored. Position lists use semicolons or pipes inside a cell. Handedness accepts `L/R/S` or `Left/Right/Switch`; omitted handedness defaults to R.

Simple bulk entry also accepts one `Name, Number` per line without headers. Quoted names containing commas are supported. A preview reports row-level errors before import. Roster import creates new player IDs; names and jersey numbers need not be unique because different players can share either.

## Derived reports versus observations

All location counts include classified and unclassified events. Contact-type distributions use and explicitly report the number of events with contact classifications; result distributions use their own classified count. Neither denominator is assumed to equal all observations. Unknown pitcher hand and batter side remain visible or excluded with context.

Density cells, directional zones, summary counts and recent-versus-season percentages are derived in memory and never replace raw events. Density intensity is relative to the most populated displayed bin. Changing filters recalculates the selected dataset. None of these summaries represent batting averages, exit velocities, real field distances or conclusions about unrecorded pitches.
