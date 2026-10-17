import { Router } from 'express';
import { extractReport } from '../services/extract.js';
import { addReport, getReport, getReports, updateReport } from '../services/store.js';
import { getStudent } from '../services/students.js';
import { isIsoDate, readId, readLessonDetails, readSections } from '../validate.js';

const router = Router();

// Validates the UI_1 inputs, including that the student exists. Returns { details } or { error }.
async function readDetailsForSave(body) {
  const result = readLessonDetails(body);
  if (result.error) return result;
  if (!(await getStudent(result.details.studentId))) return { error: 'Please select a valid student.' };
  return result;
}

// GET /api/reports — saved reports, newest lesson first.
// Optional query: from, to (YYYY-MM-DD, inclusive) and search (student name).
router.get('/', async (req, res) => {
  const { from, to } = req.query;
  if (from !== undefined && !isIsoDate(from)) return res.status(400).json({ error: 'Invalid "from" date.' });
  if (to !== undefined && !isIsoDate(to)) return res.status(400).json({ error: 'Invalid "to" date.' });
  if (from && to && from > to) return res.status(400).json({ error: 'The start date must be before the end date.' });
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';

  res.json({ reports: await getReports({ from, to, search }) });
});

// GET /api/reports/:id — one report.
router.get('/:id', async (req, res) => {
  const id = readId(req.params.id);
  const report = id && (await getReport(id));
  if (!report) return res.status(404).json({ error: 'This report could not be found.' });
  res.json({ report });
});

// POST /api/reports — saves a manually written report (used when the microphone is unavailable).
router.post('/', async (req, res) => {
  const { details, error: detailsError } = await readDetailsForSave(req.body);
  if (detailsError) return res.status(400).json({ error: detailsError });
  const { sections, error: sectionsError } = readSections(req.body);
  if (sectionsError) return res.status(400).json({ error: sectionsError });

  const report = await addReport({ ...details, sections });
  res.status(201).json({ report });
});

// POST /api/reports/generate — processes the transcript with AI and saves the result.
router.post('/generate', async (req, res) => {
  const { details, error } = await readDetailsForSave(req.body);
  if (error) return res.status(400).json({ error });

  const transcript = typeof req.body.transcript === 'string' ? req.body.transcript.trim() : '';
  if (!transcript) return res.status(400).json({ error: 'The transcript is empty.' });
  if (transcript.length > 10000) return res.status(400).json({ error: 'The transcript is too long.' });

  const { sections, source } = await extractReport(transcript);
  const report = await addReport({ ...details, sections });
  res.status(201).json({ report, source });
});

// PUT /api/reports/:id — overrides the four sections with the reviewed text (Approve & Save).
router.put('/:id', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(404).json({ error: 'This report could not be found.' });
  const { sections, error } = readSections(req.body);
  if (error) return res.status(400).json({ error });

  const report = await updateReport(id, sections);
  if (!report) return res.status(404).json({ error: 'This report could not be found.' });
  res.json({ report });
});

export default router;
