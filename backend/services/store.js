import { query } from '../db.js';

// Reports live in the student_history table, joined with student for the name and ID.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-30" -> "30 Oct 2026"
function formatDate(iso) {
  const [year, month, day] = iso.split('-');
  return `${day} ${MONTHS[Number(month) - 1]} ${year}`;
}

const SELECT_REPORT = `
  SELECT h.*, s.name AS student_name, s.student_code
  FROM student_history h
  JOIN student s ON s.id = h.student_id
`;

const ORDER = 'ORDER BY h.lesson_date DESC, h.created_at DESC, h.id DESC';

// The shape the frontend works with; section keys match lib/constants.js SECTIONS.
function toReport(row) {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentCode: row.student_code,
    Student: `${row.student_name} (${row.student_code})`,
    Syllabus: row.syllabus,
    Subject: row.subject,
    lessonDate: row.lesson_date,
    'Lesson Date': formatDate(row.lesson_date),
    Progress: row.progress,
    Strengths: row.strengths,
    'Areas for Improvement': row.areas_for_improvement,
    'Next Steps / Homework': row.next_steps_homework,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Newest lesson first. Optional filters: from / to (inclusive "YYYY-MM-DD") and search (student name).
export async function getReports({ from, to, search } = {}) {
  const where = [];
  const params = [];
  if (from) {
    params.push(from);
    where.push(`h.lesson_date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    where.push(`h.lesson_date <= $${params.length}`);
  }
  if (search) {
    params.push(`%${search.replace(/[\\%_]/g, '\\$&')}%`);
    where.push(`s.name ILIKE $${params.length}`);
  }
  const { rows } = await query(
    `${SELECT_REPORT} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ${ORDER}`,
    params,
  );
  return rows.map(toReport);
}

export async function getReport(id) {
  const { rows } = await query(`${SELECT_REPORT} WHERE h.id = $1`, [id]);
  return rows[0] ? toReport(rows[0]) : null;
}

export async function addReport({ studentId, syllabus, subject, lessonDate, sections }) {
  const { rows } = await query(
    `INSERT INTO student_history
       (student_id, syllabus, subject, lesson_date, progress, strengths, areas_for_improvement, next_steps_homework)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [
      studentId,
      syllabus,
      subject,
      lessonDate,
      sections.Progress,
      sections.Strengths,
      sections['Areas for Improvement'],
      sections['Next Steps / Homework'],
    ],
  );
  return getReport(rows[0].id);
}

// Overrides the four sections of one report. Returns null when it does not exist.
export async function updateReport(id, sections) {
  const { rowCount } = await query(
    `UPDATE student_history
     SET progress = $2, strengths = $3, areas_for_improvement = $4, next_steps_homework = $5, updated_at = now()
     WHERE id = $1`,
    [id, sections.Progress, sections.Strengths, sections['Areas for Improvement'], sections['Next Steps / Homework']],
  );
  return rowCount ? getReport(id) : null;
}
