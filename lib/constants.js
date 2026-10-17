// Options for the UI_1 inputs. Keep in sync with backend/constants.js, which validates them.
// Students come from the database (GET /api/students).
export const SYLLABUSES = ['Cambridge (IGCSE/AS/A-Level)', 'Government (GCE A-Level)'];

export const SUBJECTS = ['IT'];

// The four report sections, named exactly as the API returns them.
export const SECTIONS = ['Progress', 'Strengths', 'Areas for Improvement', 'Next Steps / Homework'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// "2026-10-30" -> "30 Oct 2026"
export function formatLessonDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!match) return '';
  return `${match[3]} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function toIso(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso() {
  return toIso(new Date());
}

// Monday to Sunday of the current week, as { from, to } "YYYY-MM-DD" strings.
export function currentWeekIso() {
  const monday = new Date();
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: toIso(monday), to: toIso(sunday) };
}

// How a student is shown in dropdowns and reports.
export function studentLabel(student) {
  return `${student.name} (${student.studentCode})`;
}

// A section is stored as one string; each line of it is shown as a separate point.
export function toLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean);
}

// Short one-line title for a history tile: the first few words of Progress.
export function shortProgress(text, words = 4) {
  const all = toLines(text).join(' ').split(/\s+/).filter(Boolean);
  if (all.length <= words) return all.join(' ');
  return `${all.slice(0, words).join(' ').replace(/[.,;:]+$/, '')}…`;
}
