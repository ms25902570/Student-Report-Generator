import { SECTIONS, SUBJECTS, SYLLABUSES } from './constants.js';

const MAX_SERIAL = 2147483647;

// "123" -> 123; anything that is not a valid table id -> null.
export function readId(value) {
  if (typeof value === 'number') value = String(value);
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && id <= MAX_SERIAL ? id : null;
}

// True for a real calendar date written as "YYYY-MM-DD".
export function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

// Returns { details } with the UI_1 inputs, or { error } describing what is wrong.
// Whether the student exists is checked against the database by the route.
export function readLessonDetails(body) {
  const details = {
    studentId: readId(body?.studentId),
    syllabus: body?.Syllabus,
    subject: body?.Subject,
    lessonDate: body?.lessonDate,
  };
  if (!details.studentId) return { error: 'Please select a valid student.' };
  if (!SYLLABUSES.includes(details.syllabus)) return { error: 'Please select a valid syllabus.' };
  if (!SUBJECTS.includes(details.subject)) return { error: 'Please select a valid subject.' };
  if (!isIsoDate(details.lessonDate)) return { error: 'Please select a valid lesson date.' };
  return { details };
}

// Returns { sections } with the four report sections, or { error }.
export function readSections(body) {
  const sections = {};
  for (const name of SECTIONS) {
    const value = body?.[name];
    if (typeof value !== 'string' || !value.trim()) return { error: `"${name}" cannot be empty.` };
    sections[name] = value.trim();
  }
  return { sections };
}

// Returns { student } with a trimmed name and upper-cased student ID, or { error }.
export function readStudent(body) {
  const name = typeof body?.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  const studentCode = typeof body?.studentCode === 'string' ? body.studentCode.trim().toUpperCase() : '';
  if (!name) return { error: 'Please enter the student name.' };
  if (name.length > 100) return { error: 'The student name must be 100 characters or fewer.' };
  if (!studentCode) return { error: 'Please enter the student ID.' };
  if (!/^[A-Z0-9-]{1,20}$/.test(studentCode)) {
    return { error: 'The student ID can only use letters, numbers and hyphens (up to 20 characters).' };
  }
  return { student: { name, studentCode } };
}
