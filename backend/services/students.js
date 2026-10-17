import { query } from '../db.js';

function toStudent(row) {
  return {
    id: row.id,
    name: row.name,
    studentCode: row.student_code,
    reportCount: Number(row.report_count || 0),
    createdAt: row.created_at,
  };
}

// All students, alphabetical, with how many reports each one has.
export async function getStudents() {
  const { rows } = await query(`
    SELECT s.*, COUNT(h.id) AS report_count
    FROM student s
    LEFT JOIN student_history h ON h.student_id = s.id
    GROUP BY s.id
    ORDER BY lower(s.name), s.student_code
  `);
  return rows.map(toStudent);
}

export async function getStudent(id) {
  const { rows } = await query('SELECT * FROM student WHERE id = $1', [id]);
  return rows[0] ? toStudent(rows[0]) : null;
}

// Returns { student } or { conflict: true } when the student ID is already taken.
export async function addStudent({ name, studentCode }) {
  try {
    const { rows } = await query('INSERT INTO student (name, student_code) VALUES ($1, $2) RETURNING *', [
      name,
      studentCode,
    ]);
    return { student: toStudent(rows[0]) };
  } catch (err) {
    if (err.code === '23505') return { conflict: true }; // unique_violation
    throw err;
  }
}
