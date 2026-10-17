// PostgreSQL connection and schema.
// Connection settings come from DATABASE_URL in backend/.env
// (e.g. postgres://postgres:password@localhost:5432/student_reports), or the standard PG* variables.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

// Return DATE columns as "YYYY-MM-DD" strings instead of JS Dates (avoids time-zone shifts).
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);

const config = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {};
const pool = new pg.Pool(config);

// An idle connection dropped by the server (e.g. PostgreSQL restarted) must not crash the
// backend; the pool simply opens a new connection for the next query.
pool.on('error', (err) => console.error(`Database connection lost: ${err.message}`));

export function query(text, params) {
  return pool.query(text, params);
}

export async function withTransaction(task) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await task(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS student (
    id           SERIAL PRIMARY KEY,
    student_code VARCHAR(20)  NOT NULL UNIQUE,
    name         VARCHAR(100) NOT NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS student_history (
    id                    SERIAL PRIMARY KEY,
    student_id            INTEGER      NOT NULL REFERENCES student (id) ON DELETE RESTRICT,
    syllabus              VARCHAR(100) NOT NULL,
    subject               VARCHAR(50)  NOT NULL,
    lesson_date           DATE         NOT NULL,
    progress              TEXT         NOT NULL,
    strengths             TEXT         NOT NULL,
    areas_for_improvement TEXT         NOT NULL,
    next_steps_homework   TEXT         NOT NULL,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
  );

  CREATE INDEX IF NOT EXISTS student_history_lesson_date_idx ON student_history (lesson_date DESC);
  CREATE INDEX IF NOT EXISTS student_history_student_id_idx ON student_history (student_id);
`;

// The students and history file used before the database existed. They are imported once,
// when the tables are first created.
const LEGACY_STUDENTS = [
  'Kavishan (Anonymous ID: S001)',
  'Kavindu (Anonymous ID: S002)',
  'Ayesha (Anonymous ID: S003)',
];
const LEGACY_FILE = path.join(import.meta.dirname, 'student_history.json');
const LEGACY_LABEL = /^(.*?)\s*\(Anonymous ID:\s*([^)]+)\)$/;

async function readLegacyHistory() {
  try {
    const data = JSON.parse(await fs.readFile(LEGACY_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function importLegacyData(client) {
  const history = await readLegacyHistory();
  const labels = [...new Set([...LEGACY_STUDENTS, ...history.map((r) => r.Student)])];
  const ids = new Map();

  for (const label of labels) {
    const match = LEGACY_LABEL.exec(label || '');
    if (!match) continue;
    const { rows } = await client.query(
      `INSERT INTO student (name, student_code) VALUES ($1, $2)
       ON CONFLICT (student_code) DO UPDATE SET student_code = EXCLUDED.student_code
       RETURNING id`,
      [match[1].trim(), match[2].trim().toUpperCase()],
    );
    ids.set(label, rows[0].id);
  }

  // The file is newest first; insert oldest first so ids follow the original order.
  for (const record of [...history].reverse()) {
    const studentId = ids.get(record.Student);
    if (!studentId) continue;
    await client.query(
      `INSERT INTO student_history
         (student_id, syllabus, subject, lesson_date, progress, strengths, areas_for_improvement, next_steps_homework)
       VALUES ($1, $2, $3, to_date($4, 'DD Mon YYYY'), $5, $6, $7, $8)`,
      [
        studentId,
        record.Syllabus,
        record.Subject,
        record['Lesson Date'],
        record.Progress || '',
        record.Strengths || '',
        record['Areas for Improvement'] || '',
        record['Next Steps / Homework'] || '',
      ],
    );
  }
  console.log(`Imported ${ids.size} students and ${history.length} reports into PostgreSQL.`);
}

// Creates the database named in DATABASE_URL when it does not exist yet.
async function createDatabaseIfMissing() {
  if (!process.env.DATABASE_URL) return false;
  const url = new URL(process.env.DATABASE_URL);
  const name = decodeURIComponent(url.pathname.slice(1));
  if (!name || name === 'postgres') return false;
  url.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
    console.log(`Created database "${name}".`);
  } finally {
    await admin.end();
  }
  return true;
}

async function initDatabase() {
  try {
    await query('SELECT 1');
  } catch (err) {
    // 3D000: database does not exist
    if (err.code !== '3D000' || !(await createDatabaseIfMissing())) throw err;
  }

  await withTransaction(async (client) => {
    // Serialise start-up across processes so the schema and import run once.
    await client.query('SELECT pg_advisory_xact_lock(724001)');
    const { rows } = await client.query(`SELECT to_regclass('public.student') IS NULL AS fresh`);
    await client.query(SCHEMA);
    if (rows[0].fresh) await importLegacyData(client);
  });
}

// Runs initDatabase once; if it fails (e.g. PostgreSQL is not running) the next request retries.
let ready = null;
export function ensureDatabase() {
  if (!ready) {
    ready = initDatabase().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

// Errors that mean "cannot reach / log in to the database" rather than a bug.
const CONNECTION_ERRORS = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '28P01', '28000', '3D000', '57P03']);

export function isConnectionError(err) {
  return CONNECTION_ERRORS.has(err?.code) || [...(err?.errors || [])].some((e) => CONNECTION_ERRORS.has(e?.code));
}
