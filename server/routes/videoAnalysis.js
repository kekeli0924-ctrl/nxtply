import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';
import { logger } from '../logger.js';
import { analyzeVideo, isConfigured } from '../services/videoAnalyzer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'uploads');

fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) cb(null, true);
  else cb(new Error(`Unsupported file type: ${ext}. Accepted: ${allowed.join(', ')}`));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 500 * 1024 * 1024 } });

const router = Router();

// GET /api/video/capabilities
router.get('/capabilities', (req, res) => {
  res.json({
    aiConfigured: isConfigured(),
    aiProvider: 'gemini',
    maxFileSize: 500 * 1024 * 1024,
    acceptedTypes: ['.mp4', '.mov', '.avi', '.webm', '.mkv'],
  });
});

// POST /api/video/upload
router.post('/upload', (req, res) => {
  // Extend timeout for large video files
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000);
  upload.single('video')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 500MB)', code: 'FILE_TOO_LARGE' });
      return res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
    }
    if (err) return res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
    if (!req.file) return res.status(400).json({ error: 'No video file provided', code: 'NO_FILE' });

    const db = getDb();
    const videoId = crypto.randomUUID();

    db.prepare(`INSERT INTO video_analyses (id, video_path, original_name, file_size, status)
      VALUES (?, ?, ?, ?, 'uploaded')`).run(videoId, req.file.path, req.file.originalname, req.file.size);

    logger.info('Video uploaded', { videoId, filename: req.file.originalname, size: req.file.size });

    res.status(201).json({ videoId, filename: req.file.originalname, size: req.file.size, status: 'uploaded' });
  });
});

// POST /api/video/:videoId/analyze — trigger Gemini analysis
router.post('/:videoId/analyze', (req, res) => {
  const db = getDb();
  const video = db.prepare('SELECT * FROM video_analyses WHERE id = ?').get(req.params.videoId);

  if (!video) return res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' });
  if (video.status === 'analyzing') return res.status(409).json({ error: 'Analysis already in progress', code: 'IN_PROGRESS' });

  if (!isConfigured()) {
    return res.status(503).json({
      error: 'GEMINI_API_KEY not set. Add it to your .env file.',
      code: 'AI_NOT_CONFIGURED',
    });
  }

  // Respond immediately, run analysis in background
  db.prepare('UPDATE video_analyses SET status = ? WHERE id = ?').run('analyzing', video.id);
  res.json({ status: 'analyzing', videoId: video.id });

  (async () => {
    try {
      const result = await analyzeVideo(video.video_path);

      // Auto-save highlight timestamp from first kick
      let clipTimestamp = null;
      const kicks = result?.kicks_detail || result?.kicks || [];
      if (kicks.length > 0) {
        clipTimestamp = kicks[0].timestamp_seconds || kicks[0].timestamp || 0;
      }

      db.prepare(`UPDATE video_analyses SET status = 'complete', analysis_result = ?, clip_timestamp = ?, completed_at = datetime('now') WHERE id = ?`)
        .run(JSON.stringify(result), clipTimestamp, video.id);

      logger.info('Video analysis complete', { videoId: video.id, clipTimestamp });
    } catch (err) {
      logger.error('Video analysis failed', { videoId: video.id, error: err.message });
      db.prepare(`UPDATE video_analyses SET status = 'error', error_message = ? WHERE id = ?`)
        .run(err.message, video.id);
    }
  })();
});

// GET /api/video/:videoId/status
router.get('/:videoId/status', (req, res) => {
  const db = getDb();
  const video = db.prepare('SELECT * FROM video_analyses WHERE id = ?').get(req.params.videoId);
  if (!video) return res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' });

  const response = {
    videoId: video.id,
    status: video.status,
    originalName: video.original_name,
    fileSize: video.file_size,
    createdAt: video.created_at,
    completedAt: video.completed_at,
  };

  if (video.status === 'complete' && video.analysis_result) {
    response.result = JSON.parse(video.analysis_result);
  }
  if (video.status === 'error') {
    response.error = video.error_message;
  }

  res.json(response);
});

// DELETE /api/video/:videoId
router.delete('/:videoId', (req, res) => {
  const db = getDb();
  const video = db.prepare('SELECT * FROM video_analyses WHERE id = ?').get(req.params.videoId);
  if (!video) return res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' });

  if (fs.existsSync(video.video_path)) fs.unlinkSync(video.video_path);
  db.prepare('DELETE FROM video_analyses WHERE id = ?').run(video.id);
  res.json({ ok: true });
});

export default router;
