import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

import sessionsRouter from './routes/sessions.js';
import matchesRouter from './routes/matches.js';
import customDrillsRouter from './routes/customDrills.js';
import settingsRouter from './routes/settings.js';
import personalRecordsRouter from './routes/personalRecords.js';
import trainingPlansRouter from './routes/trainingPlans.js';
import idpGoalsRouter from './routes/idpGoals.js';
import decisionJournalRouter from './routes/decisionJournal.js';
import benchmarksRouter from './routes/benchmarks.js';
import templatesRouter from './routes/templates.js';
import dataRouter from './routes/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// API routes
app.use('/api/sessions', sessionsRouter);
app.use('/api/matches', matchesRouter);
app.use('/api/custom-drills', customDrillsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/personal-records', personalRecordsRouter);
app.use('/api/training-plans', trainingPlansRouter);
app.use('/api/idp-goals', idpGoalsRouter);
app.use('/api/decision-journal', decisionJournalRouter);
app.use('/api/benchmarks', benchmarksRouter);
app.use('/api/templates', templatesRouter);
app.use('/api/data', dataRouter);

// Error handler for API routes
app.use('/api', (err, req, res, next) => {
  console.error(`API Error [${req.method} ${req.originalUrl}]:`, err.message);
  res.status(500).json({ error: err.message });
});

// Production: serve Vite build
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`NXTPLY API server running on http://localhost:${PORT}`);
});
