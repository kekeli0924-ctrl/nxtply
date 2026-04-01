import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRAMES_DIR = path.join(__dirname, '..', 'data', 'uploads', 'frames');

let ffmpegAvailable = null;

export function checkFfmpeg() {
  if (ffmpegAvailable !== null) return Promise.resolve(ffmpegAvailable);
  return new Promise((resolve) => {
    const proc = ffmpeg();
    proc._getFfmpegPath((err, ffmpegPath) => {
      ffmpegAvailable = !err && !!ffmpegPath;
      resolve(ffmpegAvailable);
    });
  });
}

export function getVideoDuration(videoPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) return reject(err);
      resolve(metadata.format.duration || 0);
    });
  });
}

export async function extractFrames(videoId, videoPath, targetFrames = 10) {
  const outputDir = path.join(FRAMES_DIR, videoId);
  fs.mkdirSync(outputDir, { recursive: true });

  const available = await checkFfmpeg();
  if (!available) {
    throw new Error('ffmpeg is not installed. Install it with: brew install ffmpeg (Mac) or apt install ffmpeg (Linux)');
  }

  const duration = await getVideoDuration(videoPath);
  const frameCount = Math.min(targetFrames, Math.max(8, Math.ceil(duration / 150)));
  const interval = duration / (frameCount + 1);

  const timestamps = [];
  for (let i = 1; i <= frameCount; i++) {
    timestamps.push(interval * i);
  }

  const framePaths = [];

  for (let i = 0; i < timestamps.length; i++) {
    const outputPath = path.join(outputDir, `frame_${String(i).padStart(3, '0')}.jpg`);
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .seekInput(timestamps[i])
        .frames(1)
        .size('1280x720')
        .output(outputPath)
        .on('end', () => {
          framePaths.push(outputPath);
          resolve();
        })
        .on('error', (err) => {
          // If resize fails, try without size constraint
          ffmpeg(videoPath)
            .seekInput(timestamps[i])
            .frames(1)
            .output(outputPath)
            .on('end', () => {
              framePaths.push(outputPath);
              resolve();
            })
            .on('error', reject)
            .run();
        })
        .run();
    });
  }

  return { framePaths, duration, frameCount: framePaths.length };
}

export function cleanupFrames(videoId) {
  const dir = path.join(FRAMES_DIR, videoId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
