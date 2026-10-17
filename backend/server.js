// Node.js backend for the Student Report Generator.
// The Next.js frontend forwards every /api/* request here (see next.config.mjs).

import express from 'express';
import { ensureDatabase, isConnectionError } from './db.js';
import reportsRouter from './routes/reports.js';
import studentsRouter from './routes/students.js';

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '127.0.0.1';

const app = express();
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Every other route needs the database; its tables are created on first use.
app.use('/api', async (req, res, next) => {
  await ensureDatabase();
  next();
});
app.use('/api/reports', reportsRouter);
app.use('/api/students', studentsRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found.' }));

// Central error handler: malformed JSON bodies and anything a route throws.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body.' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' });
  if (isConnectionError(err)) {
    console.error(`Database connection failed: ${err.message || err.code}`);
    return res.status(503).json({
      error: 'Could not connect to the PostgreSQL database. Check that it is running and that DATABASE_URL in backend/.env is correct.',
    });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, HOST, () => {
  console.log(`Backend listening on http://${HOST}:${PORT}`);
  console.log(
    process.env.GEMINI_API_KEY
      ? 'Report generation: Gemini'
      : 'Report generation: built-in keyword parser (GEMINI_API_KEY is not set)',
  );
  ensureDatabase().then(
    () => console.log('Database: connected (PostgreSQL)'),
    (err) => console.error(`Database: not available yet (${err.message || err.code}). Requests will retry.`),
  );
});
