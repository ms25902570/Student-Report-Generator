# AI-Assisted Student Progress Report Generator

A web app that turns a tutor's spoken lesson summary into a structured student progress report.

- **Frontend:** Next.js (App Router, React) — `app/`, `components/`, `lib/`
- **Backend:** Node.js (Express) — `backend/`
- **Storage:** PostgreSQL — tables `student` and `student_history`

## Requirements

- Node.js 24 or higher
- PostgreSQL (tested with 18)
- Chrome or Edge for recording (they provide the Web Speech API used for speech-to-text)

## Run it

1. Make sure PostgreSQL is running.
2. Copy `backend/.env.example` to `backend/.env` (or edit your existing one) and set `DATABASE_URL`, e.g.
   `DATABASE_URL=postgres://postgres:your_password@localhost:5432/student_reports`
3. Start the app:

```bash
npm install
npm run dev
```

On first start the backend creates the database (if missing) and both tables, then imports the
original three students and the reports from `backend/student_history.json` once. After that the
JSON file is no longer read or written.

This starts both servers together:

| Server | URL | Command to run it alone |
| --- | --- | --- |
| Frontend (Next.js) | http://localhost:3000 | `npm run dev:frontend` |
| Backend (Node.js) | http://127.0.0.1:4000 | `npm run dev:backend` |

Open http://localhost:3000. Use `localhost` (or HTTPS): browsers only allow microphone access on secure origins.

For a production build: `npm run build` then `npm start`.

## How the frontend and backend are connected

The browser only ever talks to the frontend. Pages call `/api/...` through the helper in
`lib/api.js`, and `next.config.mjs` forwards every `/api/*` request to the backend:

```
Browser ──> Next.js frontend (:3000) ──/api/*──> Node.js backend (:4000) ──> PostgreSQL
```

Because of this there is no CORS setup and no backend URL in browser code. To point the frontend
at a backend on another address, set `BACKEND_URL` when starting it (default `http://127.0.0.1:4000`).

## AI setup (optional but recommended)

Report generation uses Google Gemini when an API key is present.

1. Create a free key at https://aistudio.google.com/apikey
2. Copy `backend/.env.example` to `backend/.env` and set `GEMINI_API_KEY`
3. Restart `npm run dev`

Without a key (or if Gemini cannot be reached) the backend falls back to a built-in keyword parser
that follows the rules in the requirements: *covered* → Progress, *understood / identify* →
Strengths, *but* → Areas for Improvement, *Homework / Next lesson* → Next Steps / Homework. The
report screen states which one produced the report.

## Project structure

```
backend/
  server.js              Express app: middleware, error handling, starts the server
  db.js                  PostgreSQL pool, schema creation, one-time import of the old JSON data
  routes/reports.js      The /api/reports endpoints
  routes/students.js     The /api/students endpoints
  services/extract.js    Transcript -> report sections (Gemini, with keyword-parser fallback)
  services/store.js      Reads and writes the student_history table
  services/students.js   Reads and writes the student table
  validate.js            Request validation
  constants.js           Allowed syllabuses, subjects, section names
  student_history.json   Legacy data, imported into PostgreSQL on first start
  .env.example           Template for backend/.env (DATABASE_URL, Gemini key)

app/                     Next.js pages (one folder per screen)
components/              Shared React components (report view, icons)
lib/                     Frontend helpers (API client, session state, formatting)
next.config.mjs          Forwards /api/* to the backend
```

## Screens

| Screen | Route | What it does |
| --- | --- | --- |
| UI_1 Create New Report | `/` | Student (loaded from the database), Syllabus, Subject, Lesson Date. **Continue** and **Student History** buttons. |
| UI_2 Lesson Summary | `/record` | Asks for the microphone, records, transcribes, lets you edit the transcript, **Generate Report**. If the microphone is denied it shows a 500 system error and redirects to UI_4 for manual entry. |
| UI_3 Student Progress Report | `/report` | Shows the report just generated. **Edit Report** button. |
| UI_4 Review Report | `/review` | Read-only text box per section, made editable one at a time with **Edit**. **Approve & Save** is enabled only when the confirmation box is ticked. |
| UI_5 Student History | `/history` | Reports as tiles (3 per row). Shows the current week by default; date range filter, **Clear filter** (back to this week), **Show all**, and search by student name. |
| UI_6 Saved report | `/history/view?id=…` | The report for the clicked tile, with a button back to the history. |
| Students | `/students` | All students as tiles (3 per row), search by name or student ID, **Add Student** button. |
| Add Student | `/students/new` | Student Name and Student ID, **Add Student** button. |

## Backend API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/reports?from=&to=&search=` | Reports, newest lesson first. Optional date range (`YYYY-MM-DD`, inclusive) and student-name search |
| `GET` | `/api/reports/:id` | One report |
| `POST` | `/api/reports/generate` | Process a transcript with AI and save the report |
| `PUT` | `/api/reports/:id` | Override the four sections of a report (Approve & Save) |
| `POST` | `/api/reports` | Save a manually written report (microphone denied) |
| `GET` | `/api/students` | All students, with their report count |
| `POST` | `/api/students` | Add a student (`{ name, studentCode }`); `409` if the student ID exists |
| `GET` | `/api/health` | Quick check that the backend is running |

## Database tables

**student**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `SERIAL` | Primary key |
| `student_code` | `VARCHAR(20)` | The Student ID entered on Add Student; unique, stored upper-case |
| `name` | `VARCHAR(100)` | Student name |
| `created_at` | `TIMESTAMPTZ` | |

**student_history**

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `SERIAL` | Primary key |
| `student_id` | `INTEGER` | References `student(id)`, `ON DELETE RESTRICT` (a student with reports cannot be deleted) |
| `syllabus`, `subject` | `VARCHAR` | |
| `lesson_date` | `DATE` | Used by the history date filters |
| `progress`, `strengths`, `areas_for_improvement`, `next_steps_homework` | `TEXT` | The four report sections |
| `created_at`, `updated_at` | `TIMESTAMPTZ` | |

## Report format (API)

```json
{
  "id": 1,
  "studentId": 1,
  "Student": "Kavishan (S001)",
  "Syllabus": "Cambridge (IGCSE/AS/A-Level)",
  "Subject": "IT",
  "lessonDate": "2026-10-30",
  "Lesson Date": "30 Oct 2026",
  "Progress": "Covered HTML forms today.",
  "Strengths": "He understood input types.",
  "Areas for Improvement": "Needs practice with form validation.",
  "Next Steps / Homework": "Homework: build a simple login form.\nNext lesson: PHP form handling."
}
```

Each line inside a section is shown as a separate bullet point in the report.
