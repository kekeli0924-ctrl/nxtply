import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getDb } from '../db.js';
import { logger } from '../logger.js';
import { analyzeVideo, analyzeWithFrames, isConfigured } from '../services/videoAnalyzer.js';
import { Server as TusServer } from '@tus/server';
import { FileStore } from '@tus/file-store';
import { enforceDailyQuota } from '../middleware/quota.js';

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

// Video upload validation — check extension, MIME type, and magic bytes.
// Magic bytes are verified after multer finishes writing the file (see verifyVideoMagicBytes below).
const ALLOWED_EXT = ['.mp4', '.mov', '.avi', '.webm', '.mkv'];
const ALLOWED_MIME = new Set([
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/webm',
  'video/x-matroska',
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.includes(ext)) {
    return cb(new Error(`Unsupported file extension: ${ext}. Accepted: ${ALLOWED_EXT.join(', ')}`));
  }
  // Multer gives us the client-declared MIME type. Reject if it doesn't match.
  // (Not cryptographic — magic bytes verify the real type post-write.)
  if (file.mimetype && !ALLOWED_MIME.has(file.mimetype) && !file.mimetype.startsWith('video/')) {
    return cb(new Error(`Unsupported MIME type: ${file.mimetype}`));
  }
  cb(null, true);
};

// Video magic bytes — just enough to reject files renamed to .mp4 that aren't actually video.
const VIDEO_MAGIC_BYTES = [
  // MP4 / MOV — 'ftyp' at offset 4
  { offset: 4, bytes: Buffer.from('ftyp', 'ascii') },
  // WebM / MKV — EBML header 0x1A 0x45 0xDF 0xA3
  { offset: 0, bytes: Buffer.from([0x1a, 0x45, 0xdf, 0xa3]) },
  // AVI — 'RIFF' at 0, 'AVI ' at 8
  { offset: 0, bytes: Buffer.from('RIFF', 'ascii') },
];

async function verifyVideoMagicBytes(filePath) {
  try {
    const fd = await fs.promises.open(filePath, 'r');
    const buf = Buffer.alloc(16);
    await fd.read(buf, 0, 16, 0);
    await fd.close();
    return VIDEO_MAGIC_BYTES.some(({ offset, bytes }) => {
      return buf.slice(offset, offset + bytes.length).equals(bytes);
    });
  } catch {
    return false;
  }
}

const upload = multer({ storage, fileFilter, limits: { fileSize: 500 * 1024 * 1024 } });

const router = Router();

// GET /api/video/list — all completed analyses for the current user's timeline
router.get('/list', (req, res) => {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, original_name, clip_timestamp, analysis_result, completed_at FROM video_analyses WHERE status = 'complete' AND user_id = ? ORDER BY completed_at DESC LIMIT 20"
  ).all(req.userId);

  const items = rows.map(row => {
    let totalKicks = 0;
    let shotPct = null;
    try {
      const result = JSON.parse(row.analysis_result || '{}');
      const kicks = result.kicks_detail || result.kicks || [];
      totalKicks = kicks.length;
      if (result.shot_accuracy != null) shotPct = Math.round(result.shot_accuracy);
      else if (result.accuracy != null) shotPct = Math.round(result.accuracy);
    } catch { /* ignore */ }

    return {
      videoId: row.id,
      originalName: row.original_name,
      clipTimestamp: row.clip_timestamp,
      completedAt: row.completed_at,
      totalKicks,
      shotPct,
    };
  });

  res.json(items);
});

// GET /api/video/capabilities
router.get('/capabilities', (req, res) => {
  res.json({
    aiConfigured: isConfigured(),
    aiProvider: 'gemini',
    maxFileSize: 500 * 1024 * 1024,
    acceptedTypes: ['.mp4', '.mov', '.avi', '.webm', '.mkv'],
  });
});

// POST /api/video/upload — capped at 10 uploads per user per day to prevent abuse
router.post('/upload', enforceDailyQuota('video-upload', 10, 'Daily video upload limit reached (10/day). Try again tomorrow.'), (req, res) => {
  // Extend timeout for large video files
  req.setTimeout(600000); // 10 minutes
  res.setTimeout(600000);
  upload.single('video')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 500MB)', code: 'FILE_TOO_LARGE' });
      return res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
    }
    if (err) return res.status(400).json({ error: err.message, code: 'UPLOAD_ERROR' });
    if (!req.file) return res.status(400).json({ error: 'No video file provided', code: 'NO_FILE' });

    // Verify magic bytes to confirm the file is actually a video, not something renamed to .mp4.
    const isValidVideo = await verifyVideoMagicBytes(req.file.path);
    if (!isValidVideo) {
      // Delete the bogus file before rejecting
      try { await fs.promises.unlink(req.file.path); } catch { /* ignore */ }
      logger.warn('Rejected upload — invalid video magic bytes', { filename: req.file.originalname, size: req.file.size });
      return res.status(400).json({ error: 'File does not appear to be a valid video.', code: 'INVALID_VIDEO' });
    }

    const db = getDb();
    const videoId = crypto.randomUUID();

    db.prepare(`INSERT INTO video_analyses (id, video_path, original_name, file_size, status, user_id)
      VALUES (?, ?, ?, ?, 'uploaded', ?)`).run(videoId, req.file.path, req.file.originalname, req.file.size, req.userId);

    logger.info('Video uploaded', { videoId, filename: req.file.originalname, size: req.file.size });

    res.status(201).json({ videoId, filename: req.file.originalname, size: req.file.size, status: 'uploaded' });
  });
});

// POST /api/video/:videoId/analyze — trigger Gemini analysis
// Capped at 20 per user per day — Gemini calls are expensive
router.post('/:videoId/analyze', enforceDailyQuota('video-analyze', 20, 'Daily video analysis limit reached (20/day). Try again tomorrow.'), (req, res) => {
  const db = getDb();
  const video = db.prepare('SELECT * FROM video_analyses WHERE id = ? AND user_id = ?').get(req.params.videoId, req.userId);

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
      // Always prefer sending the full video to Gemini (even compressed) for accurate motion analysis.
      // Static frames can't capture kicks, ball trajectory, or timing — causing undercounts.
      // Only fall back to frame-based analysis if no video file exists.
      const hasVideo = video.video_path && fs.existsSync(video.video_path);
      const framesDir = path.join(UPLOADS_DIR, 'frames', video.id);
      const hasFrames = fs.existsSync(framesDir) && fs.readdirSync(framesDir).some(f => f.endsWith('.jpg'));

      const result = hasVideo
        ? await analyzeVideo(video.video_path)
        : hasFrames
          ? await analyzeWithFrames(framesDir)
          : (() => { throw new Error('No video or frames found for analysis'); })();

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
  const video = db.prepare('SELECT * FROM video_analyses WHERE id = ? AND user_id = ?').get(req.params.videoId, req.userId);
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
  const video = db.prepare('SELECT * FROM video_analyses WHERE id = ? AND user_id = ?').get(req.params.videoId, req.userId);
  if (!video) return res.status(404).json({ error: 'Video not found', code: 'NOT_FOUND' });

  if (fs.existsSync(video.video_path)) fs.unlinkSync(video.video_path);
  db.prepare('DELETE FROM video_analyses WHERE id = ?').run(video.id);
  res.json({ ok: true });
});

// ── Chunked upload endpoints (for client-side preprocessed videos) ──────

const FRAMES_DIR = path.join(UPLOADS_DIR, 'frames');
const CHUNKS_DIR = path.join(UPLOADS_DIR, 'chunks');
fs.mkdirSync(FRAMES_DIR, { recursive: true });
fs.mkdirSync(CHUNKS_DIR, { recursive: true });

const frameUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const videoId = req._videoId || crypto.randomUUID();
      req._videoId = videoId;
      const dir = path.join(FRAMES_DIR, videoId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, file.originalname),
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per frame
});

const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const dir = path.join(CHUNKS_DIR, req.params.videoId);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (req, file, cb) => {
      const idx = req.body.chunkIndex || '0';
      cb(null, `chunk_${idx.padStart(5, '0')}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per chunk
});

// POST /api/video/upload-frames — receive pre-extracted JPEGs
router.post('/upload-frames', (req, res) => {
  frameUpload.array('frames', 60)(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const videoId = req._videoId;
    const frameCount = parseInt(req.body.frameCount) || req.files?.length || 0;
    const originalSize = parseInt(req.body.originalSize) || 0;
    const compressedSize = parseInt(req.body.compressedSize) || 0;

    const db = getDb();
    db.prepare(`INSERT INTO video_analyses (id, video_path, original_name, file_size, status, frames_extracted, user_id)
      VALUES (?, ?, ?, ?, 'uploaded', ?, ?)`).run(
      videoId, '', 'preprocessed.mp4', originalSize, frameCount, req.userId
    );

    logger.info('Frames uploaded', { videoId, frameCount, originalSize, compressedSize });
    res.status(201).json({ videoId, frameCount });
  });
});

// POST /api/video/upload-chunk/:videoId — receive one chunk of compressed video
router.post('/upload-chunk/:videoId', (req, res) => {
  chunkUpload.single('chunk')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    res.json({ ok: true, chunkIndex: req.body.chunkIndex });
  });
});

// POST /api/video/upload-complete/:videoId — assemble chunks + trigger analysis
router.post('/upload-complete/:videoId', async (req, res) => {
  const { videoId } = req.params;
  const { totalChunks, frameCount, preprocessed } = req.body;

  const db = getDb();
  const video = db.prepare('SELECT * FROM video_analyses WHERE id = ? AND user_id = ?').get(videoId, req.userId);
  if (!video) return res.status(404).json({ error: 'Video not found' });

  try {
    // Assemble chunks into single file
    const chunksDir = path.join(CHUNKS_DIR, videoId);
    const outputPath = path.join(UPLOADS_DIR, `${videoId}.mp4`);

    if (fs.existsSync(chunksDir)) {
      const chunkFiles = fs.readdirSync(chunksDir).sort();
      const writeStream = fs.createWriteStream(outputPath);

      for (const chunkFile of chunkFiles) {
        const chunkData = fs.readFileSync(path.join(chunksDir, chunkFile));
        writeStream.write(chunkData);
      }
      writeStream.end();

      await new Promise((resolve, reject) => {
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      // Cleanup chunks
      fs.rmSync(chunksDir, { recursive: true, force: true });

      // Update DB with assembled file path
      const stats = fs.statSync(outputPath);
      db.prepare('UPDATE video_analyses SET video_path = ?, file_size = ? WHERE id = ?')
        .run(outputPath, stats.size, videoId);
    }

    logger.info('Video assembly complete', { videoId, preprocessed, frameCount });
    res.json({ videoId, status: 'assembled', preprocessed: !!preprocessed });
  } catch (err) {
    logger.error('Video assembly failed', { videoId, error: err.message });
    res.status(500).json({ error: 'Assembly failed' });
  }
});

// ── Tus resumable upload endpoint (for dual-mode session recordings) ──────

const TUS_DIR = path.join(UPLOADS_DIR, 'tus');
fs.mkdirSync(TUS_DIR, { recursive: true });

const tusServer = new TusServer({
  path: '/api/video/tus',
  datastore: new FileStore({ directory: TUS_DIR }),
  maxSize: 500 * 1024 * 1024,
  async onUploadFinish(req, res, upload) {
    try {
      const db = getDb();
      const videoId = crypto.randomUUID();
      const metadata = upload.metadata || {};
      const originalName = metadata.filename || 'session-recording.webm';
      const drillBookmarks = metadata.drillBookmarks
        ? JSON.parse(Buffer.from(metadata.drillBookmarks, 'base64').toString())
        : [];

      const uploadPath = path.join(TUS_DIR, upload.id);

      // Use authenticated req.userId only — never trust client-supplied metadata.userId.
      // Reject the upload if no authenticated user is present.
      if (!req.userId) {
        logger.error('Tus upload rejected: no authenticated user', { uploadId: upload.id });
        res.statusCode = 401;
        return res;
      }
      const tusUserId = req.userId;

      db.prepare(`INSERT INTO video_analyses (id, video_path, original_name, file_size, status, drill_bookmarks, recording_source, user_id)
        VALUES (?, ?, ?, ?, 'uploaded', ?, 'session', ?)`).run(
        videoId, uploadPath, originalName, upload.size || 0, JSON.stringify(drillBookmarks), tusUserId
      );

      logger.info('Tus upload complete', { videoId, uploadId: upload.id, size: upload.size, bookmarks: drillBookmarks.length });
      res.setHeader('X-Video-Id', videoId);
    } catch (err) {
      logger.error('Tus onUploadFinish error', { error: err.message });
    }
    return res;
  },
});

// Mount tus handler
router.all('/tus', (req, res) => tusServer.handle(req, res));
router.all('/tus/:uploadId', (req, res) => tusServer.handle(req, res));

export default router;
