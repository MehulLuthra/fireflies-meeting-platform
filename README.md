# Fireflies meeting workspace

A simple fullstack college project based on the supplied Fireflies clone assignment. It uses Next.js with TypeScript, Python FastAPI, and SQLite using Python's sqlite3 module. The code has ordinary components, HTTP endpoints, and SQL queries so it is easy to read and explain. No paid services or API keys are required.

## Start here

Extract the ZIP before running any commands. You need **Node.js 22 or newer**, npm, and **Python 3.10 or newer**. Internet access is needed to install dependencies. Start the backend and frontend in two separate terminals and keep both running.

### 1. Backend — Windows

Open a terminal inside `backend`:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000
```

### Backend — macOS or Linux

```bash
cd backend
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python -m uvicorn main:app --reload --port 8000
```

SQLite is created automatically at `backend/meetings.db`. Six sample meetings with transcripts, summaries, topics, and action items are added on the first run only. No database server is needed. API documentation: http://localhost:8000/docs.

### 2. Frontend

Open another terminal inside `frontend`:

```bash
npm ci
npm run dev
```

On Windows, if PowerShell blocks npm scripts, use `npm.cmd ci` and `npm.cmd run dev`. Open **http://localhost:3000**. The default backend address is already configured. Optional: copy `.env.example` to `.env.local` if you need to change `NEXT_PUBLIC_API_URL`, then restart the frontend.

## Features

- Meeting library with title, date, duration, and participant names.
- Search titles, participants, and transcript contents across all meetings.
- Participant and exact-date filters; newest/oldest sorting.
- Add a meeting by pasting a transcript or uploading a `.txt` file.
- Edit title, date, and participants; delete a meeting with confirmation.
- Two-panel detail page with summary, editable action items, topics, and transcript.
- Play/pause a clearly labelled placeholder timer, seek with the slider, or click a transcript line or topic. The active transcript segment follows the timer.
- Case-insensitive transcript search with highlighted matches and a match count.
- Edit and save summary notes. Add, edit, complete, and delete action items.
- Export meeting notes, tasks, and transcript as a text file.
- Responsive layout, loading/empty/error states, and notifications.
- Profile/settings, integrations, team, and live meeting placeholders.
- Every saved change persists in SQLite across restarts.

## Try the complete flow

1. Open a seeded meeting and click a transcript line. The slider and active line change to its timestamp.
2. Click Play, then seek using the slider. The active segment follows the current time.
3. Search for `will` in the transcript to see highlighted matches.
4. Edit the summary, add a task, assign it, and mark it complete.
5. Go back to the library and filter by a participant or date.
6. Click Add meeting and upload `examples/team-meeting.txt` from the extracted root folder. Enter a title and comma-separated participant names.
7. Edit metadata, export the notes, and test deleting the new meeting.
8. Restart the backend and confirm the changes remain saved.

## Transcript format and mocked notes

Use one segment per line:

```text
00:00 Aarav: Welcome to the project review.
00:30 Priya: I will finish the dashboard today.
01:15 Rohan: We need to test the API.
```

Optional brackets and `HH:MM:SS` timestamps are supported. Lines without timestamps receive timestamps spaced 30 seconds apart. Lines without speaker labels use `Speaker`. Segments are sorted by timestamp. Duration is the final timestamp plus 30 seconds for a new meeting. Text files must be at most 200 KB. `.vtt`, `.json`, audio, and video uploads are not implemented.

The UI calls the section AI Summary to match the assignment, but it is explicitly labelled Mock notes. The backend joins the first four segments into a summary, selects sentences containing words such as `will` or `need to` as suggested tasks, and picks evenly spaced segments as topics. These are simple heuristics, not real AI. You can edit the results. The placeholder player has no audio; its timer and seeking behavior are functional.

## Architecture

```text
Browser / Next.js components
       | JSON requests
       v
FastAPI endpoints (backend/main.py)
       | parameterized SQL
       v
SQLite database (backend/meetings.db)
```

- `frontend/app/page.tsx`: workspace, library, filters, and screen selection.
- `frontend/components/MeetingDetail.tsx`: transcript/player, notes, tasks, export.
- `frontend/components/MeetingForm.tsx`: create/edit form and text file reading.
- `frontend/lib/api.ts`: shared types, request helper, and date/time formatting.
- `frontend/app/globals.css`: ordinary CSS with mobile breakpoints.
- `backend/main.py`: validation and REST endpoints.
- `backend/database.py`: schema and connection/transaction helper.
- `backend/transcript.py`: transcript parsing and deterministic mock notes.
- `backend/seed.py`: sample data, added once per database.
- `backend/tests/test_api.py`: tests using a separate temporary database.

The frontend reads the `.txt` file and sends its contents as JSON. There is no separate file storage or upload service. One default user is assumed. All meetings belong to the same workspace. Next.js is used for the frontend, with ordinary client-side state; no state management library or ORM is required.

## Database schema

| Table | Columns and purpose |
| --- | --- |
| `meetings` | `id` primary key, `title`, ISO `date`, `duration` in seconds, `summary` |
| `participants` | `id`, `meeting_id` foreign key, `name`; one row per meeting participant |
| `transcripts` | `id`, `meeting_id` foreign key, `speaker`, `timestamp` in seconds, `text` |
| `action_items` | `id`, `meeting_id` foreign key, `text`, `assignee`, `completed` boolean stored as 0/1 |
| `chapters` | `id`, `meeting_id` foreign key, `title`, `timestamp` in seconds |
| `seed_state` | Internal first-run marker to avoid restoring deleted samples |

The four child tables have many-to-one relationships with meetings and `ON DELETE CASCADE`. Participant rows represent names, not separate authenticated users. Transcript speaker names and task assignees are text labels. Indexes cover meeting dates and transcript meeting/timestamp lookup. Each database operation uses a short connection with commit/rollback and foreign keys enabled.

## API overview

Base URL: `http://localhost:8000/api`. Interactive request/response schemas are available at `/docs`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Server status |
| GET | `/meetings` | Library; query parameters `q`, `participant`, `on_date`, `sort=newest\|oldest` |
| POST | `/meetings` | Create from `title`, `date`, `participants[]`, `transcript` |
| GET | `/meetings/{id}` | Full meeting with all related data |
| PUT | `/meetings/{id}` | Replace metadata with `title`, `date`, `participants[]` |
| DELETE | `/meetings/{id}` | Delete meeting and related rows; returns 204 |
| PUT | `/meetings/{id}/summary` | Save `{ "summary": "..." }` |
| POST | `/meetings/{id}/actions` | Add task with `text`, optional `assignee`, optional `completed` |
| PUT | `/meetings/{id}/actions/{taskId}` | Replace task fields |
| DELETE | `/meetings/{id}/actions/{taskId}` | Delete task |

Task and summary mutations return the updated meeting for a simple UI refresh. Missing IDs return 404; invalid input returns 422. SQL values use parameters rather than string interpolation.

## Checks

Backend (inside `backend`, Windows):

```powershell
.venv\Scripts\python.exe -m unittest discover -s tests -v
```

macOS/Linux: `.venv/bin/python -m unittest discover -s tests -v`.

Frontend (inside `frontend`):

```bash
npm run typecheck
npm run build
```

Optional local build preview: `npm run start` after `npm run build`; keep the backend running. This is not a deployment step.

## Scope and assumptions

This is a learning project, not a production service. Authentication, real transcription, LLM calls, live meeting bots, integrations, team permissions, and actual sharing are intentionally placeholders as allowed by the assignment. Transcripts are saved on creation; existing transcript editing is not included. Notes and tasks can be edited. The visual layout follows the Fireflies notebook/notepad pattern with a light sidebar, purple accents, notes on the left, and transcript on the right; it is an approximation rather than an exact pixel clone.

The requested deliverable is a source ZIP. No deployment or GitHub upload is performed. The original assignment separately asks for a public repository and a hosted demo, which the recipient can handle later. The ZIP excludes installed dependencies, local environment files, generated databases, and build files. Sample data is created from source automatically.

## Troubleshooting

- **Connection issue:** start the backend and open `http://localhost:8000/api/health`. Keep both terminals running.
- **Port already in use:** close the other local server, or choose a different port and update the frontend API URL. If the frontend runs on another port, update `FRONTEND_ORIGINS` on the backend to include that origin.
- **Want fresh sample data?** Stop the backend, then delete only `backend/meetings.db` and restart. This deletes your local meeting changes.
- **Install errors:** check Node/Python versions and internet access. Use the supplied npm lockfile with `npm ci`.
- **Sharing:** send the ZIP as-is. The recipient extracts it and follows the two setup sections above.

## Design reference

The supplied assignment is the feature specification. UI structure reference: [Fireflies Notepad guide](https://guide.fireflies.ai/articles/6653885315-learn-about-the-fireflies-notepad). The implementation was written for this project rather than copied from a clone repository.
